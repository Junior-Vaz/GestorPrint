<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed } from 'vue'

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
  if (!confirm('Excluir este fornecedor?')) return
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
  <div class="space-y-8 animate-in fade-in duration-500">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight">Gestão de Fornecedores</h2>
        <p class="text-slate-500 font-medium">Controle seus parceiros e centros de custo.</p>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="relative">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar fornecedores..." 
            class="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full md:w-64 shadow-sm"
          >
          <svg class="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <button 
          @click="openModal()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-3h6m-3 0H6"></path></svg>
          Novo Fornecedor
        </button>
      </div>
    </header>

    <div class="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-slate-50/50 border-b border-slate-100">
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
              <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading" v-for="i in 3" :key="i" class="animate-pulse">
              <td colspan="4" class="px-8 py-6 bg-slate-50/30"></td>
            </tr>
            <tr v-else-if="filteredSuppliers.length === 0">
              <td colspan="4" class="px-8 py-12 text-center text-slate-400 font-bold">Nenhum fornecedor encontrado.</td>
            </tr>
            <tr v-for="supplier in filteredSuppliers" :key="supplier.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-8 py-6">
                <span class="block font-black text-slate-900">{{ supplier.name }}</span>
                <span class="block text-xs text-slate-400 font-bold">{{ supplier.address || 'Sem endereço' }}</span>
              </td>
              <td class="px-8 py-6">
                <span class="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-tight">
                  {{ supplier.category }}
                </span>
              </td>
              <td class="px-8 py-6">
                <span class="block text-sm font-bold text-slate-700">{{ supplier.email || '-' }}</span>
                <span class="block text-xs text-slate-400 font-bold">{{ supplier.phone || '-' }}</span>
              </td>
              <td class="px-8 py-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openModal(supplier)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button @click="deleteSupplier(supplier.id)" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
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
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showModal = false"></div>
      <div class="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
        <header class="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="text-2xl font-black text-slate-900 leading-tight">
              {{ editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor' }}
            </h3>
            <p class="text-slate-500 text-sm font-medium">Preencha os dados do seu parceiro.</p>
          </div>
          <button @click="showModal = false" class="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l18 18"></path></svg>
          </button>
        </header>

        <form @submit.prevent="saveSupplier" class="p-8 space-y-6">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome / Razão Social</label>
            <input 
              v-model="form.name"
              required
              class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
              <input 
                v-model="form.phone"
                class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold"
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
              <select 
                v-model="form.category"
                class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold"
              >
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
            <input 
              v-model="form.email"
              type="email"
              class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold"
            />
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço</label>
            <input 
              v-model="form.address"
              class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold"
            />
          </div>

          <div class="pt-4">
            <button 
              type="submit"
              class="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98]"
            >
              {{ editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
