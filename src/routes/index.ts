import { routes } from "vue-router/auto-routes";
import { createWebHistory, createRouter } from "vue-router";

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
