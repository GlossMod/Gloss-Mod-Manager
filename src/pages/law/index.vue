<script setup lang="ts">
import { Search, MessageSquare, FileText, History, User, Settings, CreditCard, ChevronRight } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()

const quickLinks = [
  { name: '开始咨询', icon: MessageSquare, path: '/law/chat', desc: '全天候 AI 律师在线解答', color: 'text-blue-500' },
  { name: '文档生成', icon: FileText, path: '/law/document', desc: '一键生成专业法律文书', color: 'text-green-500' },
  { name: '我的订单', icon: History, path: '/law/orders', desc: '查看咨询及文书订单', color: 'text-orange-500' },
  { name: '个人中心', icon: User, path: '/law/profile', desc: '管理个人资料与设置', color: 'text-purple-500' },
]

const recentChats = [
  { id: 1, title: '关于劳动法解雇补偿的咨询', date: '2026-04-26 14:30' },
  { id: 2, title: '房屋租赁合同违约责任', date: '2026-04-25 09:15' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-50 relative pb-20">
    <!-- Header -->
    <header class="bg-blue-600 text-white p-6 rounded-b-3xl shadow-md">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold">AI 法律助手</h1>
          <p class="text-blue-100 text-sm mt-1">您的私人贴身法律顾问</p>
        </div>
        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center cursor-pointer" @click="router.push('/law/profile')">
          <User class="w-6 h-6 text-white" />
        </div>
      </div>
      
      <!-- Search -->
      <div class="relative w-full max-w-md mx-auto">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search class="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          class="block w-full pl-10 pr-3 py-3 border border-transparent rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-white sm:text-sm shadow-sm transition" 
          placeholder="描述您遇到的法律问题..." 
          @keyup.enter="router.push('/law/chat')"
        >
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-md mx-auto px-4 mt-6">
      
      <!-- Quick Actions -->
      <div class="grid grid-cols-2 gap-4 mb-8">
        <Card 
          v-for="link in quickLinks" 
          :key="link.name" 
          class="cursor-pointer hover:shadow-md transition-shadow active:scale-95"
          @click="router.push(link.path)"
        >
          <CardContent class="p-4 flex flex-col items-center text-center">
            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <component :is="link.icon" class="w-6 h-6" :class="link.color" />
            </div>
            <h3 class="font-semibold text-gray-900 mb-1">{{ link.name }}</h3>
            <p class="text-xs text-gray-500 line-clamp-1">{{ link.desc }}</p>
          </CardContent>
        </Card>
      </div>

      <!-- Recent History -->
      <div class="mb-4 flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-800">最近咨询</h2>
        <span class="text-sm text-blue-600 cursor-pointer hover:underline" @click="router.push('/law/orders')">查看全部</span>
      </div>
      
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        <div 
          v-for="chat in recentChats" 
          :key="chat.id"
          class="p-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
          @click="router.push('/law/chat')"
        >
          <div class="flex items-center space-x-3 truncate">
            <MessageSquare class="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div class="truncate">
              <p class="text-sm font-medium text-gray-900 truncate">{{ chat.title }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ chat.date }}</p>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-100 flex justify-around py-3 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 text-xs">
      <div class="flex flex-col items-center text-blue-600 cursor-pointer">
        <MessageSquare class="w-6 h-6 mb-1" />
        <span>咨询</span>
      </div>
      <div class="flex flex-col items-center text-gray-400 hover:text-blue-600 cursor-pointer transition" @click="router.push('/law/document')">
        <FileText class="w-6 h-6 mb-1" />
        <span>合同</span>
      </div>
      <div class="flex flex-col items-center text-gray-400 hover:text-blue-600 cursor-pointer transition" @click="router.push('/law/recharge')">
        <CreditCard class="w-6 h-6 mb-1" />
        <span>充值</span>
      </div>
      <div class="flex flex-col items-center text-gray-400 hover:text-blue-600 cursor-pointer transition" @click="router.push('/law/settings')">
        <Settings class="w-6 h-6 mb-1" />
        <span>设置</span>
      </div>
    </nav>
  </div>
</template>

<style scoped></style>
