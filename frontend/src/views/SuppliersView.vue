<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed } from 'vue'
import { useConfirm } from '../composables/useConfirm'

const { confirm: confirmDialog } = useConfirm()

interface Supplier {
  id: number
  name: string
  email: string | null
  phone: string | null
  category: string | null
  address: string | null
  createdAt: string
}

const suppliers = ref<Supplier[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingSupplier = ref<Supplier | null>(null)
const searchQuery = ref('')

const form = ref({
  name: '',
  email: '',
  phone: '',
  category: 'Geral',
  address: ''
})

const categories = [
  'Gráfica',
  'Papelaria',
  'Manutenção',
  'Marketing',
  'Serviços',
  'Geral'
]

const fetchSuppliers = async () => {
  try {
    const res = await apiFetch('/api/suppliers')
    if (res.ok) suppliers.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch suppliers', e)
  } finally {
    loading.value = false
  }
}

const openModal = (supplier: Supplier | null = null) => {
  if (supplier) {
    editingSupplier.value = supplier
    form.value = {
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      category: supplier.category || 'Geral',
      address: supplier.address || ''
    }
  } else {
    editingSupplier.value = null
    form.value = {
      name: '',
      email: '',
      phone: '',
      category: 'Geral',
      address: ''
    }
  }
  showModal.value = true
}

const saveSupplier = async () => {
  const method = editingSupplier.value ? 'PATCH' : 'POST'
  const url = editingSupplier.value
    ? `/api/suppliers/${editingSupplier.value.id}`
    : '/api/suppliers'

  try {
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (res.ok) {
      showModal.value = false
      fetchSuppliers()
    }
  } catch (e) {
    console.error('Failed to save supplier', e)
  }
}

const deleteSupplier = async (id: number) => {
  if (!await confirmDialog('Excluir este fornecedor?', { title: 'Excluir fornecedor' })) return
  try {
    const res = await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) fetchSuppliers()
  } catch (e) {
    console.error('Failed to delete supplier', e)
  }
}

const filteredSuppliers = computed(() => {
  if (!searchQuery.value) return suppliers.value
  const q = searchQuery.value.toLowerCase()
  return suppliers.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.category && s.category.toLowerCase().includes(q))
  )
})

onMounted(fetchSuppliers)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-orange-500 rounded-xl text-white shadow-lg shadow-orange-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          Gestão de Fornecedores
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Controle seus parceiros e centros de custo</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar fornecedores..."
            class="pl-10 pr-4 py-2.5 bg-white/80 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-52"
          >
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <button
          @click="openModal()"
          class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Novo Fornecedor
        </button>
      </div>
    </div>

    <!-- Table Card -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Fornecedor</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Categoria</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Contato</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-if="loading" v-for="i in 3" :key="i" class="animate-pulse">
              <td colspan="4" class="px-6 py-6 bg-slate-50/30"></td>
            </tr>
            <tr v-else-if="filteredSuppliers.length === 0">
              <td colspan="4" class="px-6 py-12 text-center text-slate-400 font-medium italic">Nenhum fornecedor encontrado.</td>
            </tr>
            <tr v-for="supplier in filteredSuppliers" :key="supplier.id" class="hover:bg-indigo-50/30 transition-colors group">
              <td class="px-6 py-4">
                <span class="block font-bold text-slate-800">{{ supplier.name }}</span>
                <span class="block text-xs text-slate-400 font-medium">{{ supplier.address || 'Sem endereço' }}</span>
              </td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 text-xs font-black rounded-lg inline-flex bg-indigo-50 text-indigo-600">
                  {{ supplier.category }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span class="block text-sm font-bold text-slate-700">{{ supplier.email || '-' }}</span>
                <span class="block text-xs text-slate-400 font-medium">{{ supplier.phone || '-' }}</span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openModal(supplier)" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button @click="deleteSupplier(supplier.id)" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Supplier Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-extrabold text-xl text-slate-800">
            {{ editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor' }}
          </h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form @submit.prevent="saveSupplier" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nome / Razão Social</label>
            <input
              v-model="form.name"
              required
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Telefone</label>
              <input
                v-model="form.phone"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Categoria</label>
              <select
                v-model="form.category"
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              >
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">E-mail</label>
            <input
              v-model="form.email"
              type="email"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Endereço</label>
            <input
              v-model="form.address"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div class="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" @click="showModal = false" class="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm">Cancelar</button>
            <button
              type="submit"
              class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 text-sm"
            >
              {{ editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
