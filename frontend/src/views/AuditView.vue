<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          Logs de Auditoria
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Rastreamento de ações e segurança do sistema</p>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          @click="fetchLogs" 
          class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
          :disabled="loading"
        >
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <div v-else class="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Atualizar
        </button>
      </div>
    </div>

    <!-- Filters placeholder (optional) -->

    <!-- Logs Table -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Data</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Operador</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Ação</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Entidade</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Detalhes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-indigo-50/30 transition-colors group">
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-semibold text-slate-600">
                  {{ log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '-' }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 uppercase">
                    {{ log.user?.name?.charAt(0) || 'S' }}
                  </div>
                  <span class="text-sm font-bold text-slate-700">{{ log.user?.name || 'Sistema' }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span 
                  class="px-3 py-1 text-xs font-black rounded-lg inline-flex"
                  :class="{
                    'bg-emerald-100 text-emerald-700': log.action === 'CREATE',
                    'bg-amber-100 text-amber-700': log.action === 'UPDATE',
                    'bg-rose-100 text-rose-700': log.action === 'DELETE'
                  }"
                >
                  {{ log.action }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span class="text-sm font-bold text-slate-700">{{ log.entity }}</span>
                <span v-if="log.entityId" class="text-xs text-slate-400 ml-1">#{{ log.entityId }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="max-w-xs overflow-hidden text-ellipsis text-xs text-slate-500 font-medium">
                  {{ log.details ? JSON.stringify(log.details) : '-' }}
                </div>
              </td>
            </tr>
            <tr v-if="logs.length === 0 && !loading">
              <td colspan="5" class="px-6 py-12 text-center text-slate-400 font-medium italic">
                Nenhum log encontrado.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const logs = ref([]);
const loading = ref(false);
const auth = useAuthStore();

const fetchLogs = async () => {
  loading.value = true;
  try {
    const response = await fetch('/api/audit', {
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });
    if (response.ok) {
      logs.value = await response.json();
    } else {
      console.error('Erro ao buscar logs:', response.statusText);
    }
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchLogs();
});
</script>
