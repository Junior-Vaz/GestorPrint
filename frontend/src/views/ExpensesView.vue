<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed } from 'vue'
import { useConfirm } from '../composables/useConfirm'

const { confirm: confirmDialog } = useConfirm()

interface Expense {
  id: number;
  description: string;
  amount: number;
  date: string;
  category: string;
  categoryName?: string;
  supplierId?: number | null;
}

const expenses = ref<Expense[]>([])
const categories = ref<{id: number, name: string}[]>([])
const suppliers = ref<{id: number, name: string}[]>([])
const loading = ref(true)
const showModal = ref(false)
const showCategoryModal = ref(false)
const editingExpense = ref<Expense | null>(null)
const newCategoryName = ref('')

const form = ref<Partial<Expense>>({
  description: '',
  amount: 0,
  category: '',
  date: new Date().toISOString().split('T')[0]
})

const exportCsv = () => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/expenses/export/csv?token=${token}`, '_blank')
}

const fetchExpenses = async () => {
  try {
    const res = await apiFetch('/api/expenses')
    if (res.ok) expenses.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch expenses', e)
  }
}

const fetchCategories = async () => {
  try {
    const res = await apiFetch('/api/expense-categories')
    if (res.ok) {
      categories.value = await res.json()
      if (categories.value.length > 0 && !form.value.category) {
        form.value.category = categories.value[0]?.name
      }
    }
  } catch (e) {
    console.error('Failed to fetch categories', e)
  }
}

const fetchSuppliers = async () => {
  try {
    const res = await apiFetch('/api/suppliers')
    if (res.ok) suppliers.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch suppliers', e)
  }
}

const addCategory = async () => {
  if (!newCategoryName.value) return
  try {
    const res = await apiFetch('/api/expense-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.value })
    })
    if (res.ok) {
      newCategoryName.value = ''
      await fetchCategories()
    }
  } catch (e) {
    console.error('Failed to add category', e)
  }
}

const deleteCategory = async (id: number) => {
  if (!await confirmDialog('Excluir esta categoria?', { title: 'Excluir categoria' })) return
  try {
    const res = await apiFetch(`/api/expense-categories/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchCategories()
  } catch (e) {
    console.error('Failed to delete category', e)
  }
}

const openModal = (expense: Expense | null = null) => {
  if (expense) {
    editingExpense.value = expense
    form.value = {
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: new Date(expense.date).toISOString().split('T')[0]
    }
  } else {
    editingExpense.value = null
    form.value = {
      description: '',
      amount: 0,
      category: categories.value[0]?.name || '',
      date: new Date().toISOString().split('T')[0]
    }
  }
  showModal.value = true
}

const saveExpense = async () => {
  const method = editingExpense.value ? 'PATCH' : 'POST'
  const url = editingExpense.value
    ? `/api/expenses/${editingExpense.value.id}`
    : '/api/expenses'

  try {
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    if (res.ok) {
      showModal.value = false
      fetchExpenses()
    }
  } catch (e) {
    console.error('Failed to save expense', e)
  }
}

const deleteExpense = async (id: number) => {
  if (!await confirmDialog('Excluir esta despesa?', { title: 'Excluir despesa' })) return
  try {
    const res = await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) fetchExpenses()
  } catch (e) {
    console.error('Failed to delete expense', e)
  }
}

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + e.amount, 0)
})

onMounted(async () => {
  loading.value = true
  await Promise.all([fetchExpenses(), fetchCategories(), fetchSuppliers()])
  loading.value = false
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-rose-500 rounded-xl text-white shadow-lg shadow-rose-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          Gestão de Despesas
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Controle seus custos fixos e variáveis</p>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <div class="bg-rose-50 px-5 py-2.5 rounded-xl border border-rose-100">
          <span class="block text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Total em Despesas</span>
          <span class="text-lg font-black text-rose-600">R$ {{ totalExpenses.toFixed(2) }}</span>
        </div>
        <button
          @click="exportCsv"
          class="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar CSV
        </button>
        <button
          @click="showCategoryModal = true"
          class="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
        >
          Categorias
        </button>
        <button
          @click="openModal()"
          class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Nova Despesa
        </button>
      </div>
    </div>

    <!-- Expenses Table -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Data</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Descrição</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Categoria</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Valor</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-if="loading">
              <td colspan="5" class="px-6 py-12 text-center text-slate-400 font-medium italic">Carregando despesas...</td>
            </tr>
            <tr v-else-if="expenses.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-slate-400 font-medium italic">Nenhuma despesa registrada.</td>
            </tr>
            <tr v-for="expense in expenses" :key="expense.id" class="hover:bg-indigo-50/30 transition-colors group">
              <td class="px-6 py-4">
                <span class="text-xs font-bold text-slate-500">{{ new Date(expense.date).toLocaleDateString() }}</span>
              </td>
              <td class="px-6 py-4">
                <span class="text-sm font-black text-slate-800">{{ expense.description }}</span>
              </td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 text-xs font-black rounded-lg inline-flex bg-slate-100 text-slate-500 uppercase tracking-widest">
                  {{ expense.category }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span class="text-sm font-black text-red-600">R$ {{ expense.amount.toFixed(2) }}</span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="openModal(expense)" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button @click="deleteExpense(expense.id)" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Expense Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-extrabold text-xl text-slate-800">
            {{ editingExpense ? 'Editar Despesa' : 'Nova Despesa' }}
          </h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form @submit.prevent="saveExpense" class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Descrição</label>
            <input
              v-model="form.description"
              type="text"
              required
              placeholder="Ex: Aluguel de Março"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Valor (R$)</label>
              <input
                v-model.number="form.amount"
                type="number"
                step="0.01"
                required
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Data</label>
              <input
                v-model="form.date"
                type="date"
                required
                class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Categoria</label>
            <select
              v-model="form.category"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
            >
              <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Fornecedor (Opcional)</label>
            <select
              v-model="form.supplierId"
              class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
            >
              <option :value="null">Nenhum</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <div class="flex gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              @click="showModal = false"
              class="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 text-sm"
            >
              Salvar Registro
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Category Management Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
      <div class="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-extrabold text-xl text-slate-800">Configurar Categorias</h3>
          <button @click="showCategoryModal = false" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="flex gap-2 mb-4">
          <input
            v-model="newCategoryName"
            placeholder="Nova categoria..."
            class="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
          <button @click="addCategory" class="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 text-sm">Add</button>
        </div>

        <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
          <div v-for="cat in categories" :key="cat.id" class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span class="text-sm font-bold text-slate-700">{{ cat.name }}</span>
            <button @click="deleteCategory(cat.id)" class="text-slate-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-md transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>

        <button
          @click="showCategoryModal = false"
          class="w-full mt-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>
