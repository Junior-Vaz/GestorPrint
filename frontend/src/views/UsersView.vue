<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const users = ref<User[]>([])
const loading = ref(true)
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)

const newUser = ref({
  name: '',
  email: '',
  password: '',
  role: 'SALES'
})

const roles = [
  { value: 'ADMIN', label: 'Administrador (Total)', color: 'bg-indigo-500' },
  { value: 'SALES', label: 'Vendas / Comercial', color: 'bg-emerald-500' },
  { value: 'PRODUCTION', label: 'Produção / Gráfica', color: 'bg-amber-500' }
]

const openModal = (user?: User) => {
  if (user) {
    isEditing.value = true
    editingId.value = user.id
    newUser.value = {
      name: user.name,
      email: user.email,
      password: '', // Password stays empty unless editing
      role: user.role
    }
  } else {
    isEditing.value = false
    editingId.value = null
    newUser.value = { name: '', email: '', password: '', role: 'SALES' }
  }
  showModal.value = true
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await fetch('/api/users')
    if (res.ok) {
      users.value = await res.json()
    }
  } catch (e) {
    console.error('Error fetching users', e)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  if (!newUser.value.name || !newUser.value.email) return;
  if (!isEditing.value && !newUser.value.password) {
    alert('Senha é obrigatória para novos usuários')
    return
  }

  try {
    const method = isEditing.value ? 'PATCH' : 'POST'
    const url = isEditing.value 
      ? `/api/users/${editingId.value}`
      : '/api/users'

    const payload: any = { ...newUser.value }
    if (isEditing.value && !payload.password) delete payload.password

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      showModal.value = false;
      await fetchUsers();
    }
  } catch (e) {
    console.error('Error saving user', e)
  }
}

const deleteUser = async (id: number) => {
  if (!confirm('Deseja realmente remover este colaborador do sistema?')) return
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchUsers()
    } else {
      const err = await res.json()
      alert(err.message || 'Erro ao excluir usuário')
    }
  } catch (e) {
    console.error('Error deleting user', e)
  }
}

const getRoleLabel = (role: string) => {
  return roles.find(r => r.value === role)?.label || role
}

onMounted(fetchUsers)
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-black text-slate-900 tracking-tight">Equipe & Colaboradores</h2>
        <p class="text-slate-500 font-medium">Gerencie o acesso e permissões do time.</p>
      </div>
      <button 
        @click="openModal()"
        class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>
        Adicionar Colaborador
      </button>
    </div>

    <!-- User Table -->
    <div class="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex-1">
      <div v-if="loading" class="p-20 flex justify-center">
        <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <div v-else-if="users.length === 0" class="p-20 text-center">
        <p class="text-slate-400 font-bold italic">Nenhum colaborador cadastrado além do administrador.</p>
      </div>

      <div v-else class="overflow-x-auto h-full">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100">
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso / Permissão</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cadastro em</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-8 py-6">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs border border-white shadow-sm">
                    {{ user.name.charAt(0) }}
                  </div>
                  <div>
                    <div class="font-black text-slate-800">{{ user.name }}</div>
                    <div class="text-[10px] text-slate-400 font-bold lowercase">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-8 py-6">
                <span :class="['px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-wider', roles.find(r => r.value === user.role)?.color]">
                  {{ getRoleLabel(user.role) }}
                </span>
              </td>
              <td class="px-8 py-6 text-xs text-slate-400 font-bold">
                {{ new Date(user.createdAt).toLocaleDateString('pt-BR') }}
              </td>
              <td class="px-8 py-6 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openModal(user)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Editar Permissões">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button @click="deleteUser(user.id)" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remover Acesso">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div class="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
        <div class="p-10">
          <header class="flex justify-between items-center mb-10">
            <div>
              <h3 class="text-2xl font-black text-slate-900 tracking-tight">
                {{ isEditing ? 'Editar Colaborador' : 'Novo Colaborador' }}
              </h3>
              <p class="text-slate-500 font-medium h-4">Defina o nível de acesso ao sistema.</p>
            </div>
            <button @click="showModal = false" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </header>

          <form @submit.prevent="handleSave" class="space-y-6">
            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
              <input v-model="newUser.name" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans" placeholder="Ex: João da Silva">
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (Login)</label>
              <input v-model="newUser.email" type="email" class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans" placeholder="joao@grafica.com">
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {{ isEditing ? 'Nova Senha (deixe vazio para manter)' : 'Senha Inicial' }}
              </label>
              <input v-model="newUser.password" type="password" class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans" placeholder="••••••••">
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Função / Nível de Acesso</label>
              <select v-model="newUser.role" class="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans appearance-none">
                <option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
            </div>

            <div class="pt-6 flex gap-3">
              <button @click="showModal = false" type="button" class="flex-1 px-5 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-50 transition-all active:scale-95">Cancelar</button>
              <button type="submit" class="flex-1 bg-slate-900 text-white px-5 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 transition-all active:scale-95">
                {{ isEditing ? 'Atualizar Dados' : 'Criar Conta' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
