/**
 * 文件相关操作
 */

import {
    basename,
    dirname,
    documentDir,
    join,
    localDataDir,
    resourceDir,
    sep,
} from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import { Command } from "@tauri-apps/plugin-shell";
import {
    copyFile as copyFileByFs,
    exists,
    lstat,
    mkdir,
    readDir,
    readFile as readBinaryFile,
    readTextFile,
    remove,
    rename,
    size,
    stat,
    writeFile as writeBinaryFile,
    writeTextFile,
} from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { ElMessage } from "element-plus-message";
import { md5 } from "js-md5";

type BinaryLike = Uint8Array | ArrayBuffer;
type FsPath = string | URL;

interface IFileSystemEntry {
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
    name: string;
    path: string;
}

interface IFileSystemMetadata {
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
    size: number;
}

export class FileHandler {
    private static readonly pathSeparator = sep();

    private static toPowerShellLiteral(value: string) {
        return `'${value.replace(/'/g, "''")}'`;
    }

    private static toShellOutputBytes(output: unknown) {
        if (output instanceof Uint8Array) {
            return output;
        }

        if (output instanceof ArrayBuffer) {
            return new Uint8Array(output);
        }

        if (ArrayBuffer.isView(output)) {
            return new Uint8Array(
                output.buffer,
                output.byteOffset,
                output.byteLength,
            );
        }

        if (Array.isArray(output)) {
            return Uint8Array.from(output);
        }

        if (
            output &&
            typeof output === "object" &&
            "data" in output &&
            Array.isArray(output.data)
        ) {
            return Uint8Array.from(output.data);
        }

        if (output && typeof output === "object" && Symbol.iterator in output) {
            return Uint8Array.from(output as Iterable<number>);
        }

        return new Uint8Array();
    }

    private static decodeShellOutput(output: unknown) {
        if (typeof output === "string") {
            return output.trim();
        }

        const bytes = FileHandler.toShellOutputBytes(output);

        if (bytes.length === 0) {
            return "";
        }

        const encodingCandidates =
            platform() === "windows" ? ["utf-8", "gb18030"] : ["utf-8"];

        for (const encoding of encodingCandidates) {
            try {
                return new TextDecoder(encoding, {
                    fatal: encoding === "utf-8",
                })
                    .decode(bytes)
                    .trim();
            } catch {
                continue;
            }
        }

        return new TextDecoder().decode(bytes).trim();
    }

    private static async executeShellCommand(
        commandName: string,
        args: string[],
    ) {
        const result =
            platform() === "windows"
                ? await Command.create(commandName, args, {
                      encoding: "raw",
                  }).execute()
                : await Command.create(commandName, args).execute();

        if (result.code === 0) {
            return result;
        }

        const stderr = FileHandler.decodeShellOutput(result.stderr);
        const stdout = FileHandler.decodeShellOutput(result.stdout);

        throw new Error(
            stderr ||
                stdout ||
                `${commandName} exited with code ${result.code ?? "null"}`,
        );
    }

    private static async createWindowsLink(
        sourcePath: string,
        targetPath: string,
        isDirectory: boolean,
    ) {
        if (!sourcePath || !targetPath) {
            throw new Error("软链接源路径或目标路径不能为空。");
        }

        // 早期实现经由 cmd.exe /c mklink 创建链接，但 cmd 的引号与 % 解析规则无法
        // 可靠转义，含特殊字符的路径可能逗出参数。改用 PowerShell 原生 cmdlet，
        // 路径始终以字符串字面量传入，不再经过二次命令行解析。
        const runNewItem = async (itemType: "SymbolicLink" | "Junction") => {
            const script = [
                "$ErrorActionPreference = 'Stop'",
                `$linkPath = ${FileHandler.toPowerShellLiteral(targetPath)}`,
                `$targetPath = ${FileHandler.toPowerShellLiteral(sourcePath)}`,
                `New-Item -ItemType ${itemType} -Path $linkPath -Target $targetPath -Force | Out-Null`,
            ].join("; ");

            const args = [
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                script,
            ];

            await FileHandler.executeShellCommand("powershell", args);
        };

        if (!isDirectory) {
            await runNewItem("SymbolicLink");
            return;
        }

        try {
            await runNewItem("SymbolicLink");
        } catch {
            // Windows 下目录符号链接可能受权限限制，失败时退回 Junction。
            await runNewItem("Junction");
        }
    }

    private static async createUnixLink(
        sourcePath: string,
        targetPath: string,
    ) {
        await FileHandler.executeShellCommand("ln", [
            "-s",
            sourcePath,
            targetPath,
        ]);
    }

    /**
     * plugin-fs 在 Tauri 2 中支持 file URL，这里把绝对路径统一转为 file URL。
     */
    private static isAbsolutePath(filePath: string) {
        const normalizedPath = FileHandler.normalizePath(filePath.trim());

        if (!normalizedPath) {
            return false;
        }

        return (
            /^[A-Za-z]:\//u.test(normalizedPath) ||
            normalizedPath.startsWith(FileHandler.pathSeparator)
        );
    }

    private static toFileUrl(filePath: string): URL {
        const normalizedPath = FileHandler.normalizePath(filePath.trim());

        if (normalizedPath.startsWith("//")) {
            return new URL(`file:${normalizedPath}`);
        }

        if (/^[A-Za-z]:\//u.test(normalizedPath)) {
            return new URL(`file:///${normalizedPath}`);
        }

        return new URL(`file://${normalizedPath}`);
    }

    private static toFsPath(filePath: string): FsPath {
        const normalizedPath = FileHandler.normalizePath(filePath.trim());

        if (!normalizedPath) {
            return normalizedPath;
        }

        return FileHandler.isAbsolutePath(normalizedPath)
            ? FileHandler.toFileUrl(normalizedPath)
            : normalizedPath;
    }

    private static async getMetadata(
        filePath: string,
        followSymlink: boolean = true,
    ): Promise<IFileSystemMetadata> {
        return followSymlink
            ? ((await stat(
                  FileHandler.toFsPath(filePath),
              )) as IFileSystemMetadata)
            : ((await lstat(
                  FileHandler.toFsPath(filePath),
              )) as IFileSystemMetadata);
    }

    private static async getDirectoryEntries(
        dirPath: string,
    ): Promise<IFileSystemEntry[]> {
        return (await readDir(
            FileHandler.toFsPath(dirPath),
        )) as IFileSystemEntry[];
    }

    private static async pathExists(filePath: string) {
        return exists(FileHandler.toFsPath(filePath));
    }

    private static async readText(filePath: string) {
        return readTextFile(FileHandler.toFsPath(filePath));
    }

    private static async writeText(filePath: string, data: string) {
        await writeTextFile(FileHandler.toFsPath(filePath), data);
    }

    private static async readBinary(filePath: string) {
        return readBinaryFile(FileHandler.toFsPath(filePath));
    }

    private static async writeBinary(filePath: string, data: Uint8Array) {
        await writeBinaryFile(FileHandler.toFsPath(filePath), data);
    }

    private static async copySingleFile(source: string, target: string) {
        await copyFileByFs(
            FileHandler.toFsPath(source),
            FileHandler.toFsPath(target),
        );
    }

    private static async renamePath(source: string, target: string) {
        await rename(
            FileHandler.toFsPath(source),
            FileHandler.toFsPath(target),
        );
    }

    private static async removePath(
        filePath: string,
        recursive: boolean = false,
    ) {
        // console.log({ filePath });

        if (recursive) {
            await remove(FileHandler.toFsPath(filePath), { recursive: true });
            return;
        }

        await remove(FileHandler.toFsPath(filePath));
    }

    /**
     * 统一路径分隔符，避免旧工程里混用 \ 和 /。
     */
    public static normalizePath(filePath: string) {
        return filePath.replace(/[\\/]+/gu, FileHandler.pathSeparator);
    }

    private static trimLeadingSeparators(filePath: string) {
        return filePath.replace(/^[/\\]+/u, "");
    }

    private static toUint8Array(data: BinaryLike | string) {
        if (typeof data === "string") {
            return new TextEncoder().encode(data);
        }

        if (data instanceof Uint8Array) {
            return data;
        }

        return new Uint8Array(data);
    }

    private static async ensureParentDirectory(filePath: string) {
        const parentDirectory = await dirname(filePath);

        if (parentDirectory) {
            await FileHandler.createDirectory(parentDirectory);
        }
    }

    private static async isFileInternal(filePath: string) {
        try {
            return (await FileHandler.getMetadata(filePath)).isFile;
        } catch {
            return false;
        }
    }

    /**
     * 计算 target 相对于 base 的相对路径。
     */
    public static async relativePath(basePath: string, targetPath: string) {
        const normalizedBase = await join(basePath);
        const normalizedTarget = await join(targetPath);

        if (!normalizedBase) {
            return FileHandler.trimLeadingSeparators(normalizedTarget);
        }

        if (normalizedBase === normalizedTarget) {
            return "";
        }

        const prefix = normalizedBase.endsWith(FileHandler.pathSeparator)
            ? normalizedBase
            : `${normalizedBase}${FileHandler.pathSeparator}`;

        if (normalizedTarget.startsWith(prefix)) {
            return FileHandler.trimLeadingSeparators(
                normalizedTarget.slice(prefix.length),
            );
        }

        return FileHandler.trimLeadingSeparators(normalizedTarget);
    }

    /**
     * 判断文件是否存在
     * @param filePath
     * @returns
     */
    public static async fileExists(filePath: string): Promise<boolean> {
        try {
            return await FileHandler.pathExists(filePath);
        } catch {
            return false;
        }
    }

    /**
     * 递归创建目录
     * @param dirPath 目录路径
     */
    public static async createDirectory(dirPath: string) {
        if (!dirPath) {
            return;
        }

        await mkdir(FileHandler.toFsPath(dirPath), { recursive: true });
    }

    /**
     * 创建文件
     * @param filePath 文件路径
     */
    public static async ensureDirectoryExistence(
        filePath: string,
        defaultValue: string = "",
    ) {
        await FileHandler.ensureParentDirectory(filePath);

        if (!(await FileHandler.fileExists(filePath))) {
            await FileHandler.writeText(filePath, defaultValue);
        }
    }

    /**
     * 复制文件
     * @param source 原文件
     * @param target 目标文件
     * @returns
     */
    public static async copyFile(source: string, target: string) {
        try {
            await FileHandler.ensureParentDirectory(target);

            if (await FileHandler.fileExists(target)) {
                const backFile = `${target}.gmmback`;
                await FileHandler.copyFile(target, backFile);
            }

            await FileHandler.copySingleFile(source, target);
            return true;
        } catch (error) {
            ElMessage.error(`复制文件失败：${error}`);
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 复制文件夹
     * @param srcPath 原文件夹
     * @param target 目标文件夹
     */
    public static async copyFolder(srcPath: string, target: string) {
        try {
            await FileHandler.createDirectory(target);
            const entries = await FileHandler.getDirectoryEntries(srcPath);

            for (const entry of entries) {
                const sourcePath = await join(srcPath, entry.name);
                const targetPath = await join(target, entry.name);

                if (entry.isDirectory) {
                    await FileHandler.copyFolder(sourcePath, targetPath);
                } else if (entry.isFile) {
                    await FileHandler.copyFile(sourcePath, targetPath);
                }
            }

            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    // 移动文件
    public static async moveFile(srcPath: string, destPath: string) {
        try {
            await FileHandler.ensureParentDirectory(destPath);
            await FileHandler.renamePath(srcPath, destPath);
            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 移动文件夹
     * @param srcPath 原文件夹
     * @param destPath 目标文件夹
     * @returns
     */
    public static async moveFolder(srcPath: string, destPath: string) {
        try {
            await FileHandler.ensureParentDirectory(destPath);
            await FileHandler.renamePath(srcPath, destPath);
            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 删除文件夹
     * @param folderPath 文件夹路径
     * @returns
     */
    public static async deleteFolder(folderPath: string): Promise<boolean> {
        try {
            if (!(await FileHandler.fileExists(folderPath))) {
                return true;
            }

            await FileHandler.removePath(folderPath, true);
            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 删除文件
     * @param filePath 文件路径
     * @returns
     */
    public static async deleteFile(filePath: string) {
        try {
            if (await FileHandler.fileExists(filePath)) {
                await FileHandler.removePath(filePath);
                const backFile = `${filePath}.gmmback`;

                if (await FileHandler.fileExists(backFile)) {
                    await FileHandler.renameFile(backFile, filePath);
                }
            }

            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 读取文件 异步
     * @param filePath 文件路径
     * @param defaultValue 若文件不存在时的创建文件的默认值
     * @returns
     */
    public static async readFileSync(
        filePath: string,
        defaultValue: string = "",
    ): Promise<string> {
        await FileHandler.ensureDirectoryExistence(filePath, defaultValue);
        return FileHandler.readText(filePath);
    }

    /**
     * 读取文件
     * @param filePath
     * @returns
     */
    public static async readFile(filePath: string, defaultValue: string = "") {
        const hasFile = await FileHandler.fileExists(filePath);
        if (!hasFile) {
            await FileHandler.ensureDirectoryExistence(filePath, defaultValue);
        }
        return FileHandler.readText(filePath);
    }

    /**
     * 写入文件
     * @param filePath 文件路径
     * @param data 写入的数据
     * @returns
     */
    public static async writeFile(filePath: string, data: string | BinaryLike) {
        try {
            await FileHandler.ensureParentDirectory(filePath);

            if (typeof data === "string") {
                await FileHandler.writeText(filePath, data);
            } else {
                await FileHandler.writeBinary(
                    filePath,
                    FileHandler.toUint8Array(data),
                );
            }

            return true;
        } catch (error) {
            ElMessage.error(`写入文件失败：${error}`);
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 写入日志
     * @param msg 日志内容
     * @param isErr 是否为错误日志
     * @returns
     */
    public static writeLog(msg: string, isErr: boolean = false) {
        if (isErr) {
            console.error(msg);
        } else {
            console.info(msg);
        }

        return true;
    }

    /**
     * 获取文件MD5
     * @param filePath 文件路径
     * @returns
     */
    public static async getFileMd5(filePath: string): Promise<string> {
        try {
            const data = await FileHandler.readBinary(filePath);
            return md5(data);
        } catch (error) {
            ElMessage.error(`获取文件MD5失败:${error}`);
            throw error;
        }
    }

    /**
     * 获取文件夹MD5
     * @param folderPath 路径
     * @returns
     */
    public static async getFolderHMd5(folderPath: string) {
        const files = await FileHandler.getFolderFiles(folderPath, true, true);
        let combinedHash = "";

        for (const filePath of files.sort()) {
            if (await FileHandler.isFileInternal(filePath)) {
                combinedHash += await FileHandler.getFileMd5(filePath);
            }
        }

        return md5(combinedHash);
    }

    /**
     * 打开文件夹
     * @param folderPath 打开文件夹
     */
    public static async openFolder(folderPath: string) {
        try {
            await openPath(folderPath);
            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 打开文件
     * @param filePath 文件路径
     */
    public static async openFile(filePath: string) {
        try {
            await openPath(filePath);
            return true;
        } catch (error) {
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 重命名文件或目录
     * @param filePath 文件路径
     * @param newName 目标名称
     * @returns
     */
    public static async renameFile(filePath: string, newName: string) {
        try {
            await FileHandler.ensureParentDirectory(newName);
            await FileHandler.renamePath(filePath, newName);
            return true;
        } catch (error) {
            ElMessage.error(`错误: ${error}`);
            return false;
        }
    }

    /**
     * 获取文件大小
     * @param filePath 文件路径
     */
    public static async getFileSize(filePath: string) {
        return size(FileHandler.toFsPath(filePath));
    }

    /**
     * 获取文件夹下的所有文件
     * @param folder
     */
    public static async getAllFiles(folder: string) {
        return FileHandler.getAllFilesInFolder(folder, true, true);
    }

    /**
     * 运行程序
     * @param exe 程序路径
     */
    public static async runExe(exe: string, options: string[] = []) {
        if (options.length > 0) {
            ElMessage.warning(
                "Tauri 前端当前不支持带参数直接启动外部程序，将忽略参数。",
            );
        }

        return FileHandler.openFile(exe);
    }

    /**
     * 创建软连接
     * @param folderPath 文件夹路径
     * @param destPath 软链接路径
     * @returns
     */
    public static async createLink(
        folderPath: string,
        destPath: string,
        backup: boolean = false,
    ) {
        const sourcePath = FileHandler.normalizePath(folderPath);
        const targetPath = FileHandler.normalizePath(destPath);
        let backupPath = "";

        try {
            await FileHandler.ensureParentDirectory(targetPath);

            if (backup && (await FileHandler.fileExists(targetPath))) {
                backupPath = `${targetPath}_back`;

                if (await FileHandler.fileExists(backupPath)) {
                    if (await FileHandler.isDir(backupPath)) {
                        await FileHandler.deleteFolder(backupPath);
                    } else {
                        await FileHandler.deleteFile(backupPath);
                    }
                }

                const renamed = await FileHandler.renameFile(
                    targetPath,
                    backupPath,
                );

                if (!renamed) {
                    return false;
                }
            }

            const isDirectory = await FileHandler.isDir(sourcePath);

            switch (platform()) {
                case "windows":
                    await FileHandler.createWindowsLink(
                        sourcePath,
                        targetPath,
                        isDirectory,
                    );
                    return true;
                case "linux":
                case "macos":
                    await FileHandler.createUnixLink(sourcePath, targetPath);
                    return true;
                default:
                    ElMessage.warning(
                        "当前平台暂不支持使用 shell 创建软连接，将退化为复制。",
                    );

                    if (isDirectory) {
                        return FileHandler.copyFolder(sourcePath, targetPath);
                    }

                    return FileHandler.copyFile(sourcePath, targetPath);
            }
        } catch (error) {
            if (
                backupPath &&
                (await FileHandler.fileExists(backupPath)) &&
                !(await FileHandler.fileExists(targetPath))
            ) {
                await FileHandler.renameFile(backupPath, targetPath);
            }

            ElMessage.error(`创建软连接失败：${error}`);
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    // 判断路径是否是软链
    public static async isSymlink(filePath: string): Promise<boolean> {
        try {
            return (await FileHandler.getMetadata(filePath, false)).isSymlink;
        } catch {
            return false;
        }
    }

    /**
     * 移除软连接
     * @param linkPath 软连接路径
     * @returns
     */
    public static async removeLink(linkPath: string, backup: boolean = false) {
        try {
            console.log({
                linkPath,
                isDir: await FileHandler.isDir(linkPath),
                backup,
            });

            if (await FileHandler.isDir(linkPath)) {
                await FileHandler.deleteFolder(linkPath);
            } else {
                await FileHandler.deleteFile(linkPath);
            }

            if (backup) {
                const backFile = `${linkPath}_back`;

                if (await FileHandler.fileExists(backFile)) {
                    await FileHandler.renameFile(backFile, linkPath);
                }
            }

            return true;
        } catch (error) {
            ElMessage.error(`移除软连接失败：${error}`);
            FileHandler.writeLog(String(error), true);
            return false;
        }
    }

    /**
     * 将路径转换为数组
     * @param filePath 路径
     * @returns
     */
    public static pathToArray(filePath: string) {
        return FileHandler.normalizePath(filePath)
            .split(FileHandler.pathSeparator)
            .filter((item) => item !== "");
    }

    /**
     * 获取文件夹中的文件列表
     * @param folderPath 路径
     * @returns
     */
    public static async getFolderFiles(
        folderPath: string,
        includepath?: boolean,
        child: boolean = false,
    ) {
        return FileHandler.getAllFilesInFolder(folderPath, includepath, child);
    }

    /**
     * 从指定路径中获取指定文件夹后的目录
     * @param folderPath 路径
     * @param folderName 查找的文件夹名
     * @param include 是否包含查找的文件夹
     * @returns
     */
    public static getFolderFromPath(
        folderPath: string,
        folderName: string,
        include = false,
    ): string | null {
        const folders = FileHandler.pathToArray(folderPath);
        const index = folders.findIndex(
            (item) => item.toLowerCase() === folderName.toLowerCase(),
        );

        if (index === -1) {
            return null;
        }

        const startIndex = include ? index : index + 1;
        return folders.slice(startIndex).join(FileHandler.pathSeparator);
    }

    // 获取程序目录下的 resources 目录
    public static async getResourcesPath() {
        return FileHandler.normalizePath(await resourceDir());
    }

    /**
     * 获取我的文档路径
     * @returns
     */
    public static async getMyDocuments() {
        return FileHandler.normalizePath(await documentDir());
    }

    /**
     * 获取公共父文件夹
     * @param paths  文件列表
     * @returns
     */
    public static getCommonParentFolder(paths: string[]): string {
        if (paths.length === 0) {
            return "";
        }

        const dirs = paths.map((item) => FileHandler.pathToArray(item));

        if (dirs.some((item) => item.length === 0)) {
            return "";
        }

        const commonSegments: string[] = [];

        for (let index = 0; index < dirs[0].length; index += 1) {
            const current = dirs[0][index];

            if (dirs.some((item) => item[index] !== current)) {
                break;
            }

            commonSegments.push(current);
        }

        return commonSegments.join(FileHandler.pathSeparator);
    }

    /**
     * 获取路径下所有的文件
     * @param folderPath 路径
     * @param includepath 是否包含路径 false
     * @param subdirectory 是否包含子文件夹 false
     * @param getFolder 是否获取文件夹路径 false
     * @returns
     */
    public static async getAllFilesInFolder(
        folderPath: string,
        includepath: boolean = false,
        subdirectory: boolean = false,
        getFolder = false,
    ) {
        if (!(await FileHandler.fileExists(folderPath))) {
            return [] as string[];
        }

        let result: string[] = [];
        const entries = await FileHandler.getDirectoryEntries(folderPath);

        for (const entry of entries) {
            const entryPath = await join(folderPath, entry.name);

            if (entry.isFile) {
                result.push(includepath ? entryPath : entry.name);
                continue;
            }

            if (entry.isDirectory) {
                if (getFolder) {
                    result.push(entryPath);
                }

                if (subdirectory) {
                    result = result.concat(
                        await FileHandler.getAllFilesInFolder(
                            entryPath,
                            includepath,
                            subdirectory,
                            getFolder,
                        ),
                    );
                }
            }
        }

        return result;
    }

    /**
     * 获取路径下所有文件夹
     * @param folderPath 路径
     * @param subdirectory 是否递归获取子目录
     * @returns
     */
    public static async getAllFolderInFolder(
        folderPath: string,
        subdirectory: boolean = false,
    ) {
        if (!(await FileHandler.fileExists(folderPath))) {
            return [] as string[];
        }

        let result: string[] = [];
        const entries = await FileHandler.getDirectoryEntries(folderPath);

        for (const entry of entries) {
            if (!entry.isDirectory) {
                continue;
            }

            const entryPath = await join(folderPath, entry.name);
            result.push(entryPath);

            if (subdirectory) {
                result = result.concat(
                    await FileHandler.getAllFolderInFolder(entryPath, true),
                );
            }
        }

        return result;
    }

    // 判断程序是否已经启动
    public static async existsSync(_name: string) {
        console.warn("Tauri 前端当前不支持直接枚举系统进程。");
        return false;
    }

    /**
     * 判断是否是文件夹
     * @param filePath 路径
     * @returns
     */
    public static async isDir(filePath: string) {
        try {
            return (await FileHandler.getMetadata(filePath)).isDirectory;
        } catch {
            return false;
        }
    }

    /**
     * 判断是否是文件
     * @param filePath 路径
     * @returns
     */
    public static async isFile(filePath: string) {
        return FileHandler.isFileInternal(filePath);
    }

    /**
     * 获取文件扩展名（不带点）。
     * Tauri 的 extname 在没有扩展名时会抛错，这里统一兜底为空字符串。
     */
    public static async getFileExtension(filePath: string) {
        const fileName = await basename(filePath);
        const lastDotIndex = fileName.lastIndexOf(".");

        if (lastDotIndex <= 0 || lastDotIndex >= fileName.length - 1) {
            return "";
        }

        return fileName.slice(lastDotIndex + 1).toLowerCase();
    }

    /**
     * 比较两个文件名是否相同
     * @param name1
     * @param name2
     * @returns
     */
    public static async compareFileName(name1: string, name2: string) {
        return (
            (await basename(name1)).toLowerCase() ===
            (await basename(name2)).toLowerCase()
        );
    }

    /**
     * 获取 appdata 路径
     * @returns 返回 C:/Users/[用户名]/AppData
     */
    public static async GetAppData() {
        return await dirname(FileHandler.normalizePath(await localDataDir()));
    }

    public static async readFileAsBase64(image: string) {
        const data = await FileHandler.readBinary(image);
        const base64 = btoa(String.fromCharCode(...data));
        return `data:image/${image.split(".").pop()};base64,${base64}`;
    }
}
