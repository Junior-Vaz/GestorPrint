<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useNotificationStore } from '../stores/notification';

const store = useNotificationStore();
const isOpen = ref(false);
const panelRef = ref<HTMLElement | null>(null);

const togglePanel = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value && store.notifications.length === 0) {
    store.fetchNotifications();
  }
};

const closePanel = (e: MouseEvent) => {
  if (panelRef.value && !panelRef.value.contains(e.target as Node)) {
    // Only close if we didn't click the bell button itself (which handles toggle)
    if (!(e.target as HTMLElement).closest('.notification-bell-btn')) {
      isOpen.value = false;
    }
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
  store.connectSocket();
  store.fetchNotifications();
  window.addEventListener('click', closePanel);
});

onUnmounted(() => {
  window.removeEventListener('click', closePanel);
});
</script>

<template>
  <div class="relative">
    <!-- Bell Button -->
    <button 
      @click="togglePanel"
      class="notification-bell-btn relative p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all active:scale-95 group shadow-sm"
    >
      <svg class="w-6 h-6 group-hover:animate-bounce-short" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
      </svg>
      
      <!-- Badge -->
      <span 
        v-if="store.unreadCount > 0"
        class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </button>

    <!-- Dropdown Panel -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95 -translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-2"
    >
      <div 
        v-if="isOpen"
        ref="panelRef"
        class="absolute right-0 mt-4 w-80 sm:w-96 bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden z-[100]"
      >
        <header class="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 class="font-black text-slate-800 tracking-tight">Notificações</h3>
          <button 
            @click="store.markAllAsRead"
            class="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
          >
            Ler tudo
          </button>
        </header>

        <div class="max-h-[400px] overflow-y-auto no-scrollbar">
          <div v-if="store.notifications.length === 0" class="p-12 text-center text-slate-400">
            <svg class="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            <p class="font-bold text-sm">Nenhuma notificação</p>
          </div>

          <div 
            v-for="n in store.notifications" 
            :key="n.id"
            @click="store.markAsRead(n.id)"
            :class="['p-5 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 group flex gap-4', !n.read ? 'bg-indigo-50/20' : 'bg-white opacity-80']"
          >
            <!-- Icon based on type -->
            <div :class="['w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-110', 
              n.type === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 
              n.type === 'WARNING' ? 'bg-amber-100 text-amber-600' : 
              n.type === 'ALERTA' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600']"
            >
              <svg v-if="n.type === 'SUCCESS'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
              <svg v-else-if="n.type === 'WARNING' || n.type === 'ALERTA'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1 gap-2">
                <p :class="['font-black text-sm truncate', !n.read ? 'text-slate-900' : 'text-slate-500']">{{ n.title }}</p>
                <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">{{ formatDate(n.createdAt) }}</span>
              </div>
              <p :class="['text-xs leading-relaxed line-clamp-2', !n.read ? 'text-slate-600 font-medium' : 'text-slate-400']">
                {{ n.message }}
              </p>
            </div>
            
            <!-- Unread dot -->
            <div v-if="!n.read" class="w-2 h-2 rounded-full bg-indigo-600 self-center"></div>
          </div>
        </div>

        <footer class="p-4 bg-slate-50/50 text-center">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistema GestorPrint v2.0</p>
        </footer>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@keyframes bounce-short {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.group-hover\:animate-bounce-short {
  animation: bounce-short 0.5s ease-in-out infinite;
}
</style>
