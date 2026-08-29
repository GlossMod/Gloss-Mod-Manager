/**
 * 数据统计
 */

import { app } from "@tauri-apps/api";
import { getApp, getApps, initializeApp } from "firebase/app";
import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import {
    getAnalytics,
    isSupported,
    logEvent,
    setUserId,
    setUserProperties,
} from "firebase/analytics";
import type { Analytics } from "firebase/analytics";
import { requestWithRetry } from "@/lib/http-client";
import { PersistentStore } from "@/lib/persistent-store";

interface IAnalyticsEventData {
    event_name: string;
    event_value?: unknown;
    user: string;
    login: string | null;
    version: string;
    language: string;
}

type FirebaseEventParamValue = string | number | boolean;

const analyticsEndpoint = "https://mod.3dmgame.com/api/gmm/analytics";

const firebaseConfig: FirebaseOptions = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

export class AppAnalytics {
    private static firebaseAnalyticsPromise: Promise<Analytics | null> | null =
        null;

    private static generateRandomNum() {
        let randomNum = "";
        for (let i = 0; i < 32; i++) {
            randomNum += Math.floor(Math.random() * 10); //生成0到9之间的随机整数，并拼接到字符串中
        }
        return randomNum;
    }

    public static async getInstanceId() {
        let id = await PersistentStore.get<string | null>(
            "app_instance_id",
            null,
        );
        if (!id) {
            id = this.generateRandomNum();
            await PersistentStore.set("app_instance_id", id);
        }
        return id;
    }

    public static async sendEvent(eventName: string, eventValue?: unknown) {
        // console.log(eventName, eventValue);
        const user = await this.getInstanceId();
        const login = null; // TODO: 用户登录系统后替换为用户 ID
        const version = await app.getVersion();
        const language = await PersistentStore.get("language", "zh-CN");

        const data = {
            event_name: eventName,
            event_value: eventValue,
            user,
            login,
            version,
            language: language ?? "zh-CN",
        };

        const [glossResult, firebaseResult] = await Promise.allSettled([
            this.sendGlossAnalytics(data),
            this.sendFirebaseAnalytics(data),
        ]);

        this.logRejectedResult("3DM 统计上报失败", glossResult);
        this.logRejectedResult("Firebase Analytics 上报失败", firebaseResult);
    }

    private static async sendGlossAnalytics(data: IAnalyticsEventData) {
        // 统计上报属于非关键请求，不必重试，但仍需超时保护。
        const res = await requestWithRetry(analyticsEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ data }),
            maxRetries: 0,
        });

        console.log({
            data: await res.json(),
        });
    }

    private static async sendFirebaseAnalytics(data: IAnalyticsEventData) {
        const analytics = await this.getFirebaseAnalytics();
        if (!analytics) {
            return;
        }

        setUserId(analytics, data.user);
        setUserProperties(analytics, {
            app_version: data.version,
            language: data.language,
            login_state: data.login ? "logged_in" : "anonymous",
        });

        logEvent(
            analytics,
            this.normalizeFirebaseEventName(data.event_name),
            this.createFirebaseEventParams(data),
        );
    }

    private static async getFirebaseAnalytics() {
        if (!this.firebaseAnalyticsPromise) {
            this.firebaseAnalyticsPromise = this.initializeFirebaseAnalytics();
        }

        return this.firebaseAnalyticsPromise;
    }

    private static async initializeFirebaseAnalytics(): Promise<Analytics | null> {
        try {
            // 本地开发环境往往没有配置 Firebase（相关变量只在 CI 注入），
            // 缺少必填项时直接跳过，避免抛出误导性的初始化错误。
            if (!firebaseConfig.projectId || !firebaseConfig.appId) {
                console.info(
                    "未配置 Firebase Analytics，已跳过初始化。",
                );
                return null;
            }

            if (!(await isSupported())) {
                console.warn(
                    "当前环境不支持 Firebase Analytics。/ Firebase Analytics is not supported in this environment.",
                );
                return null;
            }

            return getAnalytics(this.getFirebaseApp());
        } catch (error) {
            console.error("Firebase Analytics 初始化失败");
            console.error(error);
            return null;
        }
    }

    private static getFirebaseApp(): FirebaseApp {
        if (getApps().length > 0) {
            return getApp();
        }

        return initializeApp(firebaseConfig);
    }

    private static createFirebaseEventParams(data: IAnalyticsEventData) {
        const params: Record<string, FirebaseEventParamValue> = {
            app_version: data.version,
            language: data.language,
            login_state: data.login ? "logged_in" : "anonymous",
        };

        if (data.event_value === undefined) {
            return params;
        }

        params.event_value = this.normalizeFirebaseEventValue(data.event_value);
        params.event_value_type = Array.isArray(data.event_value)
            ? "array"
            : typeof data.event_value;

        return params;
    }

    private static normalizeFirebaseEventValue(value: unknown) {
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            return value;
        }

        if (value === null) {
            return "null";
        }

        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    private static normalizeFirebaseEventName(eventName: string) {
        const normalizedEventName = eventName
            .trim()
            .replace(/[^a-zA-Z0-9_]/g, "_");
        const validEventName = /^[a-zA-Z]/.test(normalizedEventName)
            ? normalizedEventName
            : `event_${normalizedEventName}`;

        return validEventName.slice(0, 40) || "custom_event";
    }

    private static logRejectedResult(
        message: string,
        result: PromiseSettledResult<void>,
    ) {
        if (result.status === "fulfilled") {
            return;
        }

        console.error(message);
        console.error(result.reason);
    }
}
