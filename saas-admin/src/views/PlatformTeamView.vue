<template>
  <SidebarLayout>
  <div class="p-8 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Equipe da plataforma</h1>
        <p class="text-sm text-slate-500 mt-1">
          Funcionários com acesso ao SaaS Admin. Operam o painel da plataforma — não são clientes/gráficas.
        </p>
      </div>
      <button @click="openCreate" class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800">
        + Novo membro
      </button>
    </div>

    <!-- Lista -->
    <div v-if="loading" class="text-center py-20 text-slate-400">
      <div class="inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="!members.length" class="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
      <p class="text-slate-500">Nenhum membro cadastrado.</p>
    </div>

    <div v-else class="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
            <th class="py-3 px-4">Nome</th>
            <th class="py-3 px-4">Email</th>
            <th class="py-3 px-4">Cadastro</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 w-32 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id" class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                  {{ initials(m.name) }}
                </div>
                <span class="font-medium text-slate-900">{{ m.name }}</span>
              </div>
            </td>
            <td class="py-3 px-4 text-slate-600">{{ m.email }}</td>
            <td class="py-3 px-4 text-slate-500 text-xs">{{ formatDate(m.createdAt) }}</td>
            <td class="py-3 px-4">
              <span :class="['inline-flex px-2 py-0.5 rounded text-[11px] font-medium',
                m.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500']">
                {{ m.isActive ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td class="py-3 px-4 text-right">
              <button @click="openEdit(m)" class="text-xs text-slate-600 hover:text-slate-900 mr-3">Editar</button>
              <button @click="confirmDelete(m)" class="text-xs text-rose-600 hover:text-rose-700">Remover</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal criar/editar -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="showModal = false"></div>
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-base font-semibold text-slate-900">
            {{ editing ? 'Editar membro' : 'Novo membro' }}
          </h2>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Nome</label>
            <input v-model="form.name" type="text" class="input" placeholder="Nome completo" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input v-model="form.email" type="email" class="input" placeholder="email@dominio.com" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              Senha <span v-if="editing" class="text-slate-400">(deixe em branco pra não alterar)</span>
            </label>
            <input v-model="form.password" type="password" class="input" placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Telefone (opcional)</label>
            <input v-model="form.phone" type="tel" class="input" placeholder="(11) 99999-9999" />
          </div>
          <div v-if="editing">
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input v-model="form.isActive" type="checkbox" class="w-4 h-4 accent-slate-900" />
              Ativo
            </label>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button @click="showModal = false" class="px-4 py-2 text-sm border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button @click="save" :disabled="saving" class="px-4 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50">
            {{ saving ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { apiFetch } from '../utils/api'
import SidebarLayout from '../components/SidebarLayout.vue'

interface PlatformMember {
  id: number
  name: string
  email: string
  photoUrl: string | null
  isActive: boolean
  createdAt: string
}

const members = ref<PlatformMember[]>([])
const loading = ref(true)
const saving = ref(false)
const showModal = ref(false)
const editing = ref<PlatformMember | null>(null)
const form = reactive({ name: '', email: '', password: '', phone: '', isActive: true })

async function load() {
  loading.value = true
  try {
    const res = await apiFetch('/api/platform-users')
    if (res.ok) members.value = await res.json()
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', email: '', password: '', phone: '', isActive: true })
  showModal.value = true
}

function openEdit(m: PlatformMember) {
  editing.value = m
  Object.assign(form, { name: m.name, email: m.email, password: '', phone: '', isActive: m.isActive })
  showModal.value = true
}

async function save() {
  if (!form.email) { alert('Email obrigatório'); return }
  if (!editing.value && !form.password) { alert('Senha obrigatória pra novo membro'); return }
  if (form.password && form.password.length < 6) { alert('Senha precisa ter pelo menos 6 caracteres'); return }

  saving.value = true
  try {
    const url = editing.value ? `/api/platform-users/${editing.value.id}` : '/api/platform-users'
    const method = editing.value ? 'PATCH' : 'POST'
    const body: any = { name: form.name, email: form.email, phone: form.phone }
    if (form.password) body.password = form.password
    if (editing.value) body.isActive = form.isActive

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      showModal.value = false
      await load()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.message || 'Erro ao salvar')
    }
  } finally {
    saving.value = false
  }
}

async function confirmDelete(m: PlatformMember) {
  if (!confirm(`Remover ${m.name} da equipe da plataforma?`)) return
  const res = await apiFetch(`/api/platform-users/${m.id}`, { method: 'DELETE' })
  if (res.ok) {
    await load()
  } else {
    const err = await res.json().catch(() => ({}))
    alert(err.message || 'Erro ao remover')
  }
}

function initials(name: string) {
  return (name || '?').split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

onMounted(load)
</script>

<style scoped>
@reference "tailwindcss";

.input {
  @apply w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200;
}
</style>
