<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { fileToCompressedDataUrl } from '../utils/image'
import { ref, onMounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { usePlanStore } from '../stores/plan'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { usePermissionsStore } from '../stores/permissions'
import PaginationControls from '../components/shared/PaginationControls.vue'

const plan = usePlanStore()
const perms = usePermissionsStore()
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
 photoUrl?: string | null;
 createdAt: string;
}

const userList = ref<User[]>([])
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')
const loading = ref(true)
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const activeTab = ref<'basic' | 'access' | 'extra'>('basic')

const newUser = ref({
 name: '',
 email: '',
 password: '',
 role: 'SALES',
 phone: '',
 document: '',
 salary: 0,
 commissionRate: 0,
 isActive: true,
 photoUrl: ''
})

// ── Upload de foto (data URL inline, igual CustomersView) ───────────────
const photoFileInput = ref<HTMLInputElement | null>(null)
const photoUploading = ref(false)
function pickPhoto() { photoFileInput.value?.click() }
async function onPhotoSelected(e: Event) {
 const input = e.target as HTMLInputElement
 const file = input.files?.[0]
 if (!file) return
 if (!file.type.startsWith('image/')) {
  showToast('Selecione um arquivo de imagem (PNG, JPG, etc).', 'warning')
  input.value = ''
  return
 }
 if (file.size > 10 * 1024 * 1024) {
  showToast('Foto muito grande. Limite: 10 MB.', 'warning')
  input.value = ''
  return
 }
 photoUploading.value = true
 try {
  // Comprime/redimensiona pra 512x512 JPEG q=0.85 — fica ~20-50KB
  // mesmo de uma foto de celular original 5MB+. Cabe folgado no JSON.
  newUser.value.photoUrl = await fileToCompressedDataUrl(file, { maxSize: 512, quality: 0.85 })
 } catch (err: any) {
  showToast(err?.message || 'Falha ao processar a imagem.', 'error')
 } finally {
  photoUploading.value = false
  input.value = ''
 }
}
function removePhoto() { newUser.value.photoUrl = '' }

const roles = [
 { value: 'ADMIN', label: 'Administrador (Total)', color: 'bg-indigo-500' },
 { value: 'SALES', label: 'Vendas / Comercial', color: 'bg-emerald-500' },
 { value: 'PRODUCTION', label: 'Produção / Gráfica', color: 'bg-amber-500' }
]

const openModal = (user?: User) => {
 activeTab.value = 'basic'
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
 isActive: user.isActive !== undefined ? user.isActive : true,
 photoUrl: user.photoUrl || ''
 }
 } else {
 isEditing.value = false
 editingId.value = null
 newUser.value = { name: '', email: '', password: '', role: 'SALES', phone: '', document: '', salary: 0, commissionRate: 0, isActive: true, photoUrl: '' }
 }
 showModal.value = true
}

const fetchUsers = async () => {
 loading.value = true
 try {
 const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
 if (search.value) params.set('search', search.value)
 const res = await apiFetch(`/api/users?${params}`)
 if (!res.ok) return
 const result = await res.json()
 if (Array.isArray(result)) {
 userList.value = result; total.value = result.length; totalPages.value = 1
 } else {
 userList.value = result.data; total.value = result.total; totalPages.value = result.totalPages
 }
 } catch (e) {
 console.error('Error fetching users', e)
 } finally {
 loading.value = false
 }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchUsers() }, 300)
watch(search, debouncedSearch)
watch([page, limit], fetchUsers)

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
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Gestão de equipe</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'usuário' : 'usuários' }}</span>
            <span v-else>Cadastre o primeiro colaborador</span>
            <span v-if="plan.data" class="ml-2 text-slate-400">
              · limite do plano: {{ plan.data.usersCount }}/{{ plan.data.maxUsers }}
            </span>
          </div>
        </div>
        <button v-if="perms.can.create('users')" @click="openModal()"
                :disabled="plan.data ? plan.data.usersCount >= plan.data.maxUsers : false"
                class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <span class="text-base leading-none">+</span>
          Novo usuário
        </button>
      </div>

      <!-- Busca -->
      <div class="relative mb-5 max-w-md">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" type="text" placeholder="Buscar por nome ou e-mail…"
               class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <!-- Loading -->
        <div v-if="loading" class="p-1">
          <div v-for="i in 4" :key="`l${i}`"
               class="grid grid-cols-[1.8fr_140px_1fr_100px_80px] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
              <div class="space-y-1.5 min-w-0 flex-1">
                <div class="h-3 bg-slate-100 rounded animate-pulse w-32"></div>
                <div class="h-2.5 bg-slate-50 rounded animate-pulse w-44"></div>
              </div>
            </div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-24"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-28"></div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-16"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-12 justify-self-end"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="userList.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhum usuário</div>
          <div class="text-xs text-slate-500 mb-4 max-w-xs">
            {{ search ? 'Ninguém bate com essa busca.' : 'Convide seus colaboradores para o sistema.' }}
          </div>
          <button v-if="search || perms.can.create('users')" @click="openModal()" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">
            {{ search ? 'Limpar busca' : 'Cadastrar primeiro usuário' }}
          </button>
        </div>

        <!-- Lista -->
        <div v-else>
          <div class="grid grid-cols-[1.8fr_140px_1fr_100px_80px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Usuário</span>
            <span>Função</span>
            <span>Telefone</span>
            <span>Status</span>
            <span class="text-right">Ações</span>
          </div>

          <div
            v-for="user in userList" :key="user.id"
            class="grid grid-cols-[1.8fr_140px_1fr_100px_80px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group text-sm"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span v-if="user.photoUrl" class="w-9 h-9 rounded-full bg-slate-100 overflow-hidden shrink-0">
                <img :src="user.photoUrl" :alt="user.name" class="w-full h-full object-cover" />
              </span>
              <span v-else class="w-9 h-9 rounded-full bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
                {{ (user.name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') }}
              </span>
              <div class="min-w-0">
                <div class="text-slate-900 font-medium truncate">{{ user.name }}</div>
                <div class="text-xs text-slate-400 truncate">{{ user.email }}</div>
              </div>
            </div>
            <span>
              <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                    :style="user.role === 'ADMIN' ? { background: '#EEEDFE', color: '#3C3489' }
                          : user.role === 'SALES' ? { background: '#E1F5EE', color: '#0F6E56' }
                          : { background: '#FAEEDA', color: '#854F0B' }">
                <span class="w-1.5 h-1.5 rounded-full"
                      :style="user.role === 'ADMIN' ? { background: '#534AB7' }
                            : user.role === 'SALES' ? { background: '#1D9E75' }
                            : { background: '#BA7517' }"></span>
                {{ getRoleLabel(user.role).split(' ')[0] }}
              </span>
            </span>
            <span class="text-slate-600 truncate">{{ user.phone || '—' }}</span>
            <span>
              <span class="inline-flex items-center gap-1.5 text-xs"
                    :style="user.isActive !== false ? { color: '#0F6E56' } : { color: '#64748B' }">
                <span class="w-1.5 h-1.5 rounded-full"
                      :style="user.isActive !== false ? { background: '#1D9E75' } : { background: '#94A3B8' }"></span>
                {{ user.isActive !== false ? 'Ativo' : 'Inativo' }}
              </span>
            </span>
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="perms.can.edit('users')" @click="openModal(user)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Editar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="perms.can.delete('users')" @click="deleteUser(user.id)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remover">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 px-4">
            <PaginationControls v-model:page="page" v-model:limit="limit" :total="total" :total-pages="totalPages"/>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showModal = false"></div>

        <div class="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 relative z-10 overflow-hidden flex flex-col max-h-[92vh] shadow-2xl">
          <!-- Header com avatar grande + upload -->
          <div class="px-6 py-5 border-b border-slate-100 flex items-center gap-4 shrink-0">
            <div class="relative shrink-0">
              <div v-if="newUser.photoUrl"
                   class="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-white ring-1 ring-slate-200">
                <img :src="newUser.photoUrl" alt="Foto do usuário" class="w-full h-full object-cover" />
              </div>
              <div v-else
                   class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-medium">
                {{ (newUser.name || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '?' }}
              </div>
              <button @click="pickPhoto" type="button" :disabled="photoUploading"
                      class="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                      :title="newUser.photoUrl ? 'Trocar foto' : 'Adicionar foto'">
                <svg v-if="!photoUploading" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span v-else class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </button>
              <button v-if="newUser.photoUrl" @click="removePhoto" type="button"
                      class="absolute -top-1 -right-1 w-5 h-5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remover foto">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <input ref="photoFileInput" type="file" accept="image/*" class="hidden" @change="onPhotoSelected" />
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="text-base font-medium text-slate-900 truncate">
                {{ isEditing ? (newUser.name || 'Editar usuário') : 'Novo usuário' }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ isEditing ? 'Atualize os dados do colaborador' : 'Preencha as abas para cadastrar' }}
              </p>
            </div>

            <button @click="showModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="px-6 border-b border-slate-100 flex items-center gap-1 shrink-0">
            <button v-for="t in [
              { id: 'basic',  label: 'Dados básicos' },
              { id: 'access', label: 'Acesso & permissões' },
              { id: 'extra',  label: 'Outros' },
            ] as const" :key="t.id"
              @click="activeTab = t.id"
              :class="['px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === t.id
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-500 border-transparent hover:text-slate-700']">
              {{ t.label }}
            </button>
          </div>

          <!-- Conteúdo das tabs -->
          <form @submit.prevent="handleSave" class="flex-1 overflow-y-auto px-6 py-5">
            <!-- ════ Aba 1: Dados básicos ═══════════════════════════════════ -->
            <div v-show="activeTab === 'basic'" class="space-y-4">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Nome completo <span class="text-rose-500">*</span></label>
                <input v-model="newUser.name" type="text" required placeholder="Ex: João Silva"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-slate-500 mb-1.5">E-mail <span class="text-rose-500">*</span></label>
                  <input v-model="newUser.email" type="email" required placeholder="joao@empresa.com"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                </div>
                <div>
                  <label class="block text-xs text-slate-500 mb-1.5">Telefone</label>
                  <input v-model="newUser.phone" type="text" placeholder="(00) 00000-0000"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                </div>
              </div>

              <div>
                <label class="block text-xs text-slate-500 mb-1.5">CPF</label>
                <input v-model="newUser.document" type="text" placeholder="000.000.000-00"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                <p class="mt-1 text-[11px] text-slate-400">Opcional. Usado em folha de pagamento e relatórios.</p>
              </div>
            </div>

            <!-- ════ Aba 2: Acesso & permissões ════════════════════════════ -->
            <div v-show="activeTab === 'access'" class="space-y-4">
              <!-- Função -->
              <div>
                <label class="block text-xs text-slate-500 mb-2">Função <span class="text-rose-500">*</span></label>
                <div class="grid grid-cols-3 gap-2">
                  <button v-for="r in roles" :key="r.value" type="button"
                          @click="newUser.role = r.value"
                          :class="['flex flex-col items-center gap-1 py-3 px-2 rounded-lg border transition-colors text-center',
                            newUser.role === r.value ? 'font-medium' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50']"
                          :style="newUser.role === r.value
                            ? (r.value === 'ADMIN' ? { backgroundColor: '#EEEDFE', color: '#3C3489', borderColor: '#534AB7' }
                              : r.value === 'SALES' ? { backgroundColor: '#E1F5EE', color: '#0F6E56', borderColor: '#1D9E75' }
                              : { backgroundColor: '#FAEEDA', color: '#854F0B', borderColor: '#BA7517' })
                            : {}">
                    <span class="w-1.5 h-1.5 rounded-full"
                          :style="r.value === 'ADMIN' ? { background: '#534AB7' }
                                : r.value === 'SALES' ? { background: '#1D9E75' }
                                : { background: '#BA7517' }"></span>
                    <span class="text-xs">{{ r.label.split(' ')[0] }}</span>
                  </button>
                </div>
                <p class="mt-2 text-[11px] text-slate-400">
                  <span v-if="newUser.role === 'ADMIN'">Acesso total ao sistema, configurações e gestão.</span>
                  <span v-else-if="newUser.role === 'SALES'">Acesso ao PDV, orçamentos, clientes e pedidos.</span>
                  <span v-else>Acesso ao Kanban de produção e atualização de status.</span>
                </p>
              </div>

              <div>
                <label class="block text-xs text-slate-500 mb-1.5">
                  {{ isEditing ? 'Nova senha (deixe em branco para manter)' : 'Senha' }}
                  <span v-if="!isEditing" class="text-rose-500">*</span>
                </label>
                <input v-model="newUser.password" type="password" :required="!isEditing" placeholder="••••••••"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                <p v-if="!isEditing" class="mt-1 text-[11px] text-slate-400">Mínimo 6 caracteres recomendado.</p>
              </div>

              <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div class="text-xs text-slate-500">Usuário ativo</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    {{ newUser.isActive ? 'Pode acessar o sistema' : 'Login bloqueado — usuário não consegue logar' }}
                  </div>
                </div>
                <label class="cursor-pointer">
                  <input type="checkbox" v-model="newUser.isActive" class="sr-only peer">
                  <span class="relative inline-block w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-slate-900 transition-colors">
                    <span class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></span>
                  </span>
                </label>
              </div>
            </div>

            <!-- ════ Aba 3: Outros (financeiro/comissões) ═════════════════ -->
            <div v-show="activeTab === 'extra'" class="space-y-4">
              <div v-if="plan.hasCommissions" class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-slate-500 mb-1.5">Salário (R$)</label>
                  <input v-model.number="newUser.salary" type="number" step="0.01" min="0" placeholder="0,00"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <p class="mt-1 text-[11px] text-slate-400">Aparece no relatório de folha.</p>
                </div>
                <div>
                  <label class="block text-xs text-slate-500 mb-1.5">Comissão (%)</label>
                  <input v-model.number="newUser.commissionRate" type="number" step="0.1" min="0" max="100" placeholder="0"
                         class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <p class="mt-1 text-[11px] text-slate-400">Calculada sobre vendas com este vendedor.</p>
                </div>
              </div>
              <div v-else class="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center">
                <svg class="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div class="text-sm font-medium text-slate-700">Comissões não disponíveis no seu plano</div>
                <div class="text-xs text-slate-500 mt-1">Faça upgrade pro plano PRO ou ENTERPRISE pra cadastrar salário e comissão por vendedor.</div>
              </div>

              <div class="pt-2 border-t border-slate-100">
                <p class="text-[11px] text-slate-400">
                  Outros campos (endereço, observações, RG, etc.) podem ser adicionados em versões futuras.
                </p>
              </div>
            </div>
          </form>

          <!-- Footer ações -->
          <div class="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="showModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="handleSave"
                    :disabled="!newUser.name || !newUser.email || (!isEditing && !newUser.password)"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {{ isEditing ? 'Atualizar' : 'Criar usuário' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
