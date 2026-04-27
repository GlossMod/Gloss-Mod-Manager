<script setup lang="ts">
import Navbar from "./Navbar.vue";
import Footer from "./Footer.vue";
</script>

<template>
    <div
        class="min-h-screen flex flex-col font-sans bg-background text-foreground selection:bg-primary selection:text-primary-foreground"
    >
        <Navbar />
        <main class="flex-grow w-full flex flex-col">
            <slot />
        </main>
        <Footer />
    </div>
</template>

<style scoped></style>
