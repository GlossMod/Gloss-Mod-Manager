import { defaultWindowIcon } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Aria2Rpc } from "@/lib/aria2-rpc";
import {
    hasPendingAppUpdateInstall,
    installPendingAppUpdate,
} from "@/lib/app-updater";
import { PersistentStore } from "@/lib/persistent-store";
import { SecretStore } from "@/lib/secret-store";
import router from "@/routes";

//#region 全局托盘相关逻辑
const TRAY_ID = "main-tray";
let tray: TrayIcon | null = null;
let unlistenCloseRequested: (() => void) | null = null;
let isQuitting = false;

async function showMainWindow() {
    const appWindow = getCurrentWindow();

    if (await appWindow.isMinimized()) {
        await appWindow.unminimize();
    }

    await appWindow.show();
    await appWindow.setFocus();
}

async function prepareQuitApplication() {
    isQuitting = true;

    if (unlistenCloseRequested) {
        unlistenCloseRequested();
        unlistenCloseRequested = null;
    }

    if (tray) {
        await tray.close();
        tray = null;
    }

    try {
        // AI API Key 等凭据写入加密存储前有防抖，退出前必须强制落盘，
        // 否则用户刚填完就退出会导致下次打开又是空的。
        await SecretStore.flushAll();
    } catch (error) {
        console.error("退出前落盘加密凭据失败");
        console.error(error);
    }

    try {
        // 退出应用前主动关闭 aria2 sidecar，避免 dev 构建时目标文件被占用。
        await Aria2Rpc.stopServer();
    } catch (error) {
        console.error("停止 aria2 服务失败");
        console.error(error);
    }
}

async function quitApplication(
    trigger: "close-window" | "quit-app" = "quit-app",
) {
    await prepareQuitApplication();

    const startedUpdateInstall = await installPendingAppUpdate(trigger, false);

    if (startedUpdateInstall && platform() === "windows") {
        return;
    }

    await getCurrentWindow().destroy();
}

async function setupTray() {
    if (!isTauri() || tray) {
        return;
    }

    const appWindow = getCurrentWindow();
    const icon = await defaultWindowIcon();

    const menu = await Menu.new({
        items: [
            {
                id: "open",
                text: "打开",
                action: () => {
                    void showMainWindow();
                },
            },
            {
                id: "quit",
                text: "退出",
                action: () => {
                    void quitApplication();
                },
            },
        ],
    });

    const existingTray = await TrayIcon.getById(TRAY_ID);

    if (existingTray) {
        await existingTray.close();
    }

    tray = await TrayIcon.new({
        id: TRAY_ID,
        icon: icon ?? undefined,
        menu,
        showMenuOnLeftClick: false,
        tooltip: "Gloss Mod Manager",
        action: (event) => {
            if (
                event.type === "Click" &&
                event.button === "Left" &&
                event.buttonState === "Up"
            ) {
                void showMainWindow();
            }
        },
    });

    if (!unlistenCloseRequested) {
        unlistenCloseRequested = await appWindow.onCloseRequested((event) => {
            if (isQuitting) {
                return;
            }

            event.preventDefault();

            if (hasPendingAppUpdateInstall()) {
                void quitApplication("close-window");
                return;
            }

            void appWindow.hide();
        });
    }
}
setupTray();

//#endregion

//#region 设置默认启动页
async function setupDefaultRoute() {
    const defaultStartPage = await PersistentStore.get<string>(
        "defaultStartPage",
        "index",
    );

    await router.isReady();

    const targetRoute = router
        .getRoutes()
        .find(
            (route) =>
                route.name === defaultStartPage ||
                route.path === defaultStartPage,
        );

    if (!targetRoute) {
        console.warn(`未找到默认启动页路由: ${defaultStartPage}`);
        return;
    }

    if (router.currentRoute.value.path === targetRoute.path) {
        return;
    }

    await router.replace(targetRoute.path);
}

setupDefaultRoute();
//#endregion

//#region 发送应用启动事件
AppAnalytics.sendEvent("start");

//#endregion
