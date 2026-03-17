<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

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
  window.open('/api/expenses/export/csv', '_blank')
}

const fetchExpenses = async () => {
  try {
    const res = await fetch('/api/expenses')
    if (res.ok) expenses.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch expenses', e)
  }
}

const fetchCategories = async () => {
  try {
    const res = await fetch('/api/expense-categories')
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
    const res = await fetch('/api/suppliers')
    if (res.ok) suppliers.value = await res.json()
  } catch (e) {
    console.error('Failed to fetch suppliers', e)
  }
}

const addCategory = async () => {
  if (!newCategoryName.value) return
  try {
    const res = await fetch('/api/expense-categories', {
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
  if (!confirm('Excluir esta categoria?')) return
  try {
    const res = await fetch(`/api/expense-categories/${id}`, { method: 'DELETE' })
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
    const res = await fetch(url, {
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
  if (!confirm('Excluir esta despesa?')) return
  try {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
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
  <div class="space-y-8 animate-in fade-in duration-500">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight">Gestão de Despesas</h2>
        <p class="text-slate-500 font-medium">Controle seus custos fixos e variáveis.</p>
      </div>
      
      <div class="flex items-center gap-4">
        <button 
          @click="exportCsv"
          class="px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar CSV
        </button>
        <button 
          @click="showCategoryModal = true"
          class="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
        >
          Categorias
        </button>
        <div class="bg-red-50 px-6 py-3 rounded-2xl border border-red-100">
          <span class="block text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Total em Despesas</span>
          <span class="text-xl font-black text-red-600">R$ {{ totalExpenses.toFixed(2) }}</span>
        </div>
        <button 
          @click="openModal()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          Nova Despesa
        </button>
      </div>
    </header>

    <!-- Expenses Table -->
    <div class="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
      <table class="w-full text-left">
        <thead>
          <tr class="bg-slate-50/50 border-b border-slate-100">
            <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
            <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
            <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
            <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
            <th class="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading">
            <td colspan="5" class="px-8 py-12 text-center text-slate-400 font-medium italic">Carregando despesas...</td>
          </tr>
          <tr v-else-if="expenses.length === 0">
            <td colspan="5" class="px-8 py-12 text-center text-slate-400 font-medium italic">Nenhuma despesa registrada.</td>
          </tr>
          <tr v-for="expense in expenses" :key="expense.id" class="hover:bg-slate-50/50 transition-colors group">
            <td class="px-8 py-5">
              <span class="text-xs font-bold text-slate-500">{{ new Date(expense.date).toLocaleDateString() }}</span>
            </td>
            <td class="px-8 py-5">
              <span class="text-sm font-black text-slate-800">{{ expense.description }}</span>
            </td>
            <td class="px-8 py-5">
              <span class="px-3 py-1 bg-slate-100 text-[10px] font-black text-slate-500 rounded-lg uppercase tracking-widest">
                {{ expense.category }}
              </span>
            </td>
            <td class="px-8 py-5">
              <span class="text-sm font-black text-red-600">R$ {{ expense.amount.toFixed(2) }}</span>
            </td>
            <td class="px-8 py-5 text-right">
              <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="openModal(expense)" class="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button @click="deleteExpense(expense.id)" class="p-2 text-slate-400 hover:text-red-600 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showModal = false"></div>
      <div class="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
        <header class="p-8 border-b border-slate-100">
          <h3 class="text-2xl font-black text-slate-900 leading-tight">
            {{ editingExpense ? 'Editar Despesa' : 'Nova Despesa' }}
          </h3>
          <p class="text-slate-500 text-sm font-medium">Preencha os dados da movimentação financeira.</p>
        </header>

        <form @submit.prevent="saveExpense" class="p-8 space-y-6">
          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
            <input 
              v-model="form.description"
              type="text" 
              required
              placeholder="Ex: Aluguel de Março"
              class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
              <input 
                v-model.number="form.amount"
                type="number" 
                step="0.01"
                required
                class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
              <input 
                v-model="form.date"
                type="date" 
                required
                class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
            <select 
              v-model="form.category"
              class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
            >
              <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
            </select>
          </div>

          <div class="space-y-2">
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fornecedor (Opcional)</label>
            <select 
              v-model="form.supplierId"
              class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
            >
              <option :value="null">Nenhum</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>

          <div class="flex gap-4 pt-4">
            <button 
              type="button"
              @click="showModal = false"
              class="flex-1 px-6 py-4 border border-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              class="flex-1 px-6 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
            >
              Salvar Registro
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Category Management Modal -->
    <div v-if="showCategoryModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showCategoryModal = false"></div>
      <div class="bg-white w-full max-w-md rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
        <header class="p-8 border-b border-slate-100">
          <h3 class="text-2xl font-black text-slate-900 leading-tight">Configurar Categorias</h3>
          <p class="text-slate-500 text-sm font-medium">Personalize seus centros de custo.</p>
        </header>

        <div class="p-8 space-y-6">
          <div class="flex gap-2">
            <input 
              v-model="newCategoryName"
              placeholder="Nova categoria..."
              class="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold"
            />
            <button @click="addCategory" class="px-6 bg-indigo-600 text-white font-black rounded-2xl">Add</button>
          </div>

          <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            <div v-for="cat in categories" :key="cat.id" class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span class="text-sm font-bold text-slate-700">{{ cat.name }}</span>
              <button @click="deleteCategory(cat.id)" class="text-red-400 hover:text-red-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>

          <button 
            @click="showCategoryModal = false"
            class="w-full py-4 border border-slate-100 text-slate-500 font-black rounded-2xl"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
