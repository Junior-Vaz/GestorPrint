<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted } from 'vue'
import { usePlanStore } from '../stores/plan'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'

const plan = usePlanStore()
const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  document?: string;
  salary?: number;
  commissionRate?: number;
  isActive?: boolean;
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
  role: 'SALES',
  phone: '',
  document: '',
  salary: 0,
  commissionRate: 0,
  isActive: true
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
      role: user.role,
      phone: user.phone || '',
      document: user.document || '',
      salary: user.salary || 0,
      commissionRate: user.commissionRate || 0,
      isActive: user.isActive !== undefined ? user.isActive : true
    }
  } else {
    isEditing.value = false
    editingId.value = null
    newUser.value = { name: '', email: '', password: '', role: 'SALES', phone: '', document: '', salary: 0, commissionRate: 0, isActive: true }
  }
  showModal.value = true
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await apiFetch('/api/users')
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
    showToast('Senha é obrigatória para novos usuários.', 'warning')
    return
  }

  try {
    const method = isEditing.value ? 'PATCH' : 'POST'
    const url = isEditing.value
      ? `/api/users/${editingId.value}`
      : '/api/users'

    const payload: any = { ...newUser.value }
    if (isEditing.value && !payload.password) delete payload.password

    const res = await apiFetch(url, {
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
  if (!await confirmDialog('Deseja realmente remover este colaborador do sistema?', { title: 'Remover usuário' })) return
  try {
    const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchUsers()
    } else {
      const err = await res.json()
      showToast(err.message || 'Erro ao excluir usuário.', 'error')
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
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-slate-700 rounded-xl text-white shadow-lg shadow-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          Equipe & Colaboradores
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Gerencie o acesso e permissões do time</p>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="openModal()"
          class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>
          Adicionar Colaborador
        </button>
      </div>
    </div>

    <!-- User Table -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center p-20">
        <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="users.length === 0" class="p-20 text-center">
        <p class="text-slate-400 font-bold italic">Nenhum colaborador cadastrado além do administrador.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Colaborador</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Acesso / Permissão</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Cadastro em</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="user in users" :key="user.id" class="hover:bg-indigo-50/30 transition-colors group">
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs border border-white shadow-sm">
                    {{ user.name.charAt(0) }}
                  </div>
                  <div>
                    <div class="font-bold text-slate-800">{{ user.name }}</div>
                    <div class="text-xs text-slate-400 font-medium lowercase">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span :class="['px-3 py-1 text-xs font-black rounded-lg inline-flex text-white', roles.find(r => r.value === user.role)?.color]">
                  {{ getRoleLabel(user.role) }}
                </span>
              </td>
              <td class="px-6 py-4 text-xs text-slate-400 font-bold">
                {{ new Date(user.createdAt).toLocaleDateString('pt-BR') }}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openModal(user)" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all" title="Editar Permissões">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button @click="deleteUser(user.id)" class="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-all" title="Remover Acesso">
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
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h3 class="font-extrabold text-xl text-slate-800">
              {{ isEditing ? 'Editar Colaborador' : 'Novo Colaborador' }}
            </h3>
            <p class="text-slate-500 text-sm font-medium">Defina o nível de acesso ao sistema.</p>
          </div>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form @submit.prevent="handleSave" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nome Completo</label>
            <input v-model="newUser.name" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" placeholder="Ex: João da Silva">
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Email (Login)</label>
            <input v-model="newUser.email" type="email" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" placeholder="joao@grafica.com">
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">
              {{ isEditing ? 'Nova Senha (deixe vazio para manter)' : 'Senha Inicial' }}
            </label>
            <input v-model="newUser.password" type="password" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm" placeholder="••••••••">
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Função / Nível de Acesso</label>
            <select v-model="newUser.role" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none">
              <option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option>
            </select>
          </div>

          <div class="border-t border-slate-100 pt-4">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Dados de Funcionário</h4>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">CPF / Documento</label>
                <input v-model="newUser.document" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Telefone</label>
                <input v-model="newUser.phone" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Salário Base (R$)</label>
                <input v-model.number="newUser.salary" type="number" step="0.01" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
              <div v-if="plan.hasCommissions">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Comissão (%)</label>
                <input v-model.number="newUser.commissionRate" type="number" step="0.1" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
            </div>

            <label class="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
              <input v-model="newUser.isActive" type="checkbox" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500">
              Funcionário Ativo no Sistema
            </label>
          </div>

          <div class="flex gap-3 pt-2 border-t border-slate-100">
            <button @click="showModal = false" type="button" class="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm">Cancelar</button>
            <button type="submit" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 text-sm">
              {{ isEditing ? 'Atualizar Dados' : 'Criar Conta' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
