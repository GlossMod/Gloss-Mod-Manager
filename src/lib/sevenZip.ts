import {
    Sidecar,
    type SidecarCommandOptions,
    type SidecarResult,
} from "@/lib/sidecar";

export type SevenZipOverwriteMode =
    | "skip"
    | "overwrite"
    | "rename-existing"
    | "rename-new";

export type SevenZipArchiveFormat =
    | "7z"
    | "zip"
    | "tar"
    | "gz"
    | "xz"
    | "bzip2"
    | string;

export interface SevenZipExtractOptions extends SidecarCommandOptions {
    archivePath: string;
    outputDirectory: string;
    password?: string;
    overwriteMode?: SevenZipOverwriteMode;
    includePatterns?: string[];
    excludePatterns?: string[];
    extraArgs?: string[];
    assumeYes?: boolean;
}

export interface SevenZipCreateOptions extends SidecarCommandOptions {
    archivePath: string;
    sources: string[];
    format?: SevenZipArchiveFormat;
    password?: string;
    overwriteMode?: SevenZipOverwriteMode;
    compressionLevel?: 0 | 1 | 3 | 5 | 7 | 9;
    solidMode?: boolean;
    encryptHeaders?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    extraArgs?: string[];
    assumeYes?: boolean;
}

export interface SevenZipListOptions extends SidecarCommandOptions {
    archivePath: string;
    password?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    extraArgs?: string[];
}

export interface SevenZipTestOptions extends SidecarCommandOptions {
    archivePath: string;
    password?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    extraArgs?: string[];
}

export interface SevenZipArchiveEntry {
    path: string;
    size?: number;
    packedSize?: number;
    modified?: string;
    created?: string;
    accessed?: string;
    attributes?: string;
    crc?: string;
    method?: string;
    block?: number;
    encrypted?: boolean;
    isDirectory: boolean;
}

export interface SevenZipListResult {
    entries: SevenZipArchiveEntry[];
    raw: SidecarResult;
}

export class SevenZip {
    private static readonly OVERWRITE_MODE_ARGUMENTS: Record<
        SevenZipOverwriteMode,
        string
    > = {
        skip: "-aos",
        overwrite: "-aoa",
        "rename-existing": "-aou",
        "rename-new": "-aot",
    };

    /**
     * 按 7-Zip 规则追加包含或排除匹配模式。
     */
    private static appendPatternArgs(
        args: string[],
        prefix: "-i!" | "-x!",
        patterns?: string[],
    ) {
        for (const pattern of patterns ?? []) {
            args.push(`${prefix}${pattern}`);
        }
    }

    /**
     * 在传入密码时追加解压或压缩密码参数。
     */
    private static appendPasswordArg(args: string[], password?: string) {
        if (password) {
            args.push(`-p${password}`);
        }
    }

    /**
     * 追加文件覆盖策略参数。
     */
    private static appendOverwriteArg(
        args: string[],
        overwriteMode: SevenZipOverwriteMode = "overwrite",
    ) {
        args.push(SevenZip.OVERWRITE_MODE_ARGUMENTS[overwriteMode]);
    }

    /**
     * 需要时自动确认 7-Zip 的交互提示。
     */
    private static appendConfirmArg(args: string[], assumeYes = true) {
        if (assumeYes) {
            args.push("-y");
        }
    }

    /**
     * 将列表输出中的数字字段安全转换为 number。
     */
    private static parseOptionalNumber(value: string | undefined) {
        if (!value) {
            return undefined;
        }

        const parsed = Number.parseInt(value, 10);

        return Number.isFinite(parsed) ? parsed : undefined;
    }

    /**
     * 将一段 7-Zip 列表记录转换为结构化条目。
     */
    private static toArchiveEntry(
        record: Record<string, string>,
    ): SevenZipArchiveEntry | null {
        if (!record.Path) {
            return null;
        }

        const hasFileFields =
            "Folder" in record ||
            "Size" in record ||
            "Packed Size" in record ||
            "Encrypted" in record ||
            "CRC" in record;

        if (!hasFileFields) {
            return null;
        }

        return {
            path: record.Path,
            size: SevenZip.parseOptionalNumber(record.Size),
            packedSize: SevenZip.parseOptionalNumber(record["Packed Size"]),
            modified: record.Modified,
            created: record.Created,
            accessed: record.Accessed,
            attributes: record.Attributes,
            crc: record.CRC,
            method: record.Method,
            block: SevenZip.parseOptionalNumber(record.Block),
            encrypted: record.Encrypted === "+",
            isDirectory: record.Folder === "+",
        };
    }

    /**
     * 解析 7-Zip `l -slt` 输出为条目列表。
     */
    private static parseListOutput(output: string) {
        const entries: SevenZipArchiveEntry[] = [];
        let currentRecord: Record<string, string> = {};

        for (const line of output.split(/\r?\n/u)) {
            if (!line.trim()) {
                const entry = SevenZip.toArchiveEntry(currentRecord);

                if (entry) {
                    entries.push(entry);
                }

                currentRecord = {};
                continue;
            }

            const separatorIndex = line.indexOf(" = ");

            if (separatorIndex === -1) {
                continue;
            }

            const key = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 3).trim();

            currentRecord[key] = value;
        }

        const trailingEntry = SevenZip.toArchiveEntry(currentRecord);

        if (trailingEntry) {
            entries.push(trailingEntry);
        }

        return entries;
    }

    /**
     * 校验压缩包条目路径是否会逆向穿越到目标目录之外（zip slip）。
     *
     * mod 压缩包来自不可信来源，7-Zip 虽然自身会做一定防护，
     * 但这里显式拦一道，避免依赖外部工具的默认行为。
     */
    private static assertSafeEntryPaths(entries: SevenZipArchiveEntry[]) {
        for (const entry of entries) {
            const normalizedPath = entry.path.replace(/\\/gu, "/");

            if (/^[A-Za-z]:/u.test(normalizedPath)) {
                throw new Error(
                    `压缩包内存在绕到绝对路径的条目，已阻止解压：${entry.path}`,
                );
            }

            if (normalizedPath.startsWith("/")) {
                throw new Error(
                    `压缩包内存在绝对路径条目，已阻止解压：${entry.path}`,
                );
            }

            if (normalizedPath.split("/").includes("..")) {
                throw new Error(
                    `压缩包内存在上级目录穿越条目，已阻止解压：${entry.path}`,
                );
            }
        }
    }

    /**
     * 解压指定压缩包到目标目录。
     */
    public static async extractArchive(options: SevenZipExtractOptions) {
        // 解压前先列出条目做穿越校验；列表失败（如加密包）时不阻断正常流程。
        try {
            const listResult = await SevenZip.listArchive({
                archivePath: options.archivePath,
                password: options.password,
            });

            SevenZip.assertSafeEntryPaths(listResult.entries);
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                error.message.includes("已阻止解压")
            ) {
                throw error;
            }

            console.warn("无法预先校验压缩包条目路径，已跳过穿越检查。");
            console.warn(error);
        }

        const args = ["x", options.archivePath, `-o${options.outputDirectory}`];

        SevenZip.appendPasswordArg(args, options.password);
        SevenZip.appendOverwriteArg(args, options.overwriteMode);
        SevenZip.appendPatternArgs(args, "-i!", options.includePatterns);
        SevenZip.appendPatternArgs(args, "-x!", options.excludePatterns);
        SevenZip.appendConfirmArg(args, options.assumeYes);

        args.push(...(options.extraArgs ?? []));

        return Sidecar.executeSevenZip(args, options);
    }

    /**
     * 根据配置创建新的压缩包。
     */
    public static async createArchive(options: SevenZipCreateOptions) {
        const args = [
            "a",
            options.archivePath,
            ...options.sources,
            `-t${options.format ?? "7z"}`,
        ];

        SevenZip.appendPasswordArg(args, options.password);
        SevenZip.appendOverwriteArg(args, options.overwriteMode);
        SevenZip.appendPatternArgs(args, "-i!", options.includePatterns);
        SevenZip.appendPatternArgs(args, "-x!", options.excludePatterns);
        SevenZip.appendConfirmArg(args, options.assumeYes);

        if (typeof options.compressionLevel === "number") {
            args.push(`-mx=${options.compressionLevel}`);
        }

        if (typeof options.solidMode === "boolean") {
            args.push(`-ms=${options.solidMode ? "on" : "off"}`);
        }

        if (options.password && options.encryptHeaders) {
            args.push("-mhe=on");
        }

        args.push(...(options.extraArgs ?? []));

        return Sidecar.executeSevenZip(args, options);
    }

    /**
     * 列出压缩包内容并解析为结构化结果。
     */
    public static async listArchive(
        options: SevenZipListOptions,
    ): Promise<SevenZipListResult> {
        const args = ["l", "-slt", options.archivePath];

        SevenZip.appendPasswordArg(args, options.password);
        SevenZip.appendPatternArgs(args, "-i!", options.includePatterns);
        SevenZip.appendPatternArgs(args, "-x!", options.excludePatterns);
        args.push(...(options.extraArgs ?? []));

        const raw = await Sidecar.executeSevenZip(args, options);

        return {
            entries: SevenZip.parseListOutput(raw.stdout),
            raw,
        };
    }

    /**
     * 测试压缩包完整性而不实际解压。
     */
    public static async testArchive(options: SevenZipTestOptions) {
        const args = ["t", options.archivePath];

        SevenZip.appendPasswordArg(args, options.password);
        SevenZip.appendPatternArgs(args, "-i!", options.includePatterns);
        SevenZip.appendPatternArgs(args, "-x!", options.excludePatterns);
        args.push(...(options.extraArgs ?? []));

        return Sidecar.executeSevenZip(args, options);
    }
}
