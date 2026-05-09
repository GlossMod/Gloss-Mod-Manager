<script lang="ts" setup>
import AppHeader from "@/components/base/AppHeader.vue";
import LeftMenu from "@/components/base/LeftMenu.vue";
import Global from "@/components/base/Global.vue";
import { ElNotification } from "element-plus";

function message() {
    ElNotification({
        offset: 60,
        duration: 0,
        title: "全新版本可用",
        type: "success",
        message: `最新的v2版本现已发布, 全新的框架，更小的的体积，
        更好的AI兼容,兼容旧版数据, 
        新增支持 Linux 、macOS 系统.
        点击下载体验
        `,
        onClick: () => {
            window.open("https://gmm.aoe.top/docs/FQA/updataForV1");
        },
    });
}

message();
</script>
<template>
    <v-card>
        <v-layout>
            <Global></Global>
            <AppHeader></AppHeader>
            <LeftMenu></LeftMenu>
            <v-main style="min-height: 100vh">
                <router-view v-slot="{ Component }">
                    <keep-alive>
                        <component :is="Component" />
                    </keep-alive>
                </router-view>
            </v-main>
        </v-layout>
    </v-card>
</template>

<script lang="ts">
export default {
    name: "App",
};
</script>
<style lang="less" scoped>
.common-layout {
    .main {
        margin-top: 40px;
        max-height: calc(100vh - 50px);
        overflow: hidden;
    }
}
</style>
