<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from '../composables/useConfirm'
import { usePlanStore } from '../stores/plan'
import { usePermissionsStore } from '../stores/permissions'
import PaginationControls from '../components/shared/PaginationControls.vue'

const plan = usePlanStore()
const perms = usePermissionsStore()

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

const expenseList = ref<Expense[]>([])
const categories = ref<{id: number, name: string}[]>([])
const suppliers = ref<{id: number, name: string}[]>([])
const loading = ref(true)
const showModal = ref(false)
const showCategoryModal = ref(false)
const editingExpense = ref<Expense | null>(null)
const newCategoryName = ref('')

const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')
const categoryFilter = ref('')
const startDate = ref('')
const endDate = ref('')

const form = ref<Partial<Expense>>({
 description: '',
 amount: 0,
 category: '',
 date: new Date().toISOString().split('T')[0]
})

const exportCsv = () => {
  if (!plan.hasReports) {
    plan.setLimitError('Exportação Excel requer o módulo de Relatórios.')
    return
  }
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/expenses/export/xlsx?token=${token}`, '_blank')
}

const fetchExpenses = async () => {
 loading.value = true
 try {
 const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
 if (search.value) params.set('search', search.value)
 if (categoryFilter.value) params.set('status', categoryFilter.value)
 if (startDate.value) params.set('startDate', startDate.value)
 if (endDate.value) params.set('endDate', endDate.value)

 const res = await apiFetch(`/api/expenses?${params}`)
 if (!res.ok) return
 const result = await res.json()
 if (Array.isArray(result)) {
 expenseList.value = result
 total.value = result.length
 totalPages.value = 1
 } else {
 expenseList.value = result.data
 total.value = result.total
 totalPages.value = result.totalPages
 }
 } catch (e) {
 console.error('Failed to fetch expenses', e)
 } finally {
 loading.value = false
 }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchExpenses() }, 300)
watch(search, debouncedSearch)
watch([page, limit, categoryFilter, startDate, endDate], fetchExpenses)

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
 return expenseList.value.reduce((sum, e) => sum + e.amount, 0)
})

onMounted(() => {
 Promise.all([fetchExpenses(), fetchCategories(), fetchSuppliers()])
})
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header + CTAs -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Despesas</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'despesa registrada' : 'despesas registradas' }}</span>
            <span v-else>Nenhuma despesa no período</span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Total em destaque -->
          <div class="flex flex-col justify-center px-4 py-1.5 rounded-lg border"
               style="border-color:#FCEBEB; background:#FCEBEB">
            <span class="text-[10px]" style="color:#A32D2D">Total</span>
            <span class="text-sm font-medium" style="color:#A32D2D">R$ {{ totalExpenses.toFixed(2) }}</span>
          </div>

          <button @click="exportCsv"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Exportar
          </button>

          <button v-if="perms.can.create('expenses')" @click="showCategoryModal = true"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
            Categorias
          </button>

          <button v-if="perms.can.create('expenses')" @click="openModal()"
                  class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors">
            <span class="text-base leading-none">+</span>
            Nova despesa
          </button>
        </div>
      </div>

      <!-- Filtros -->
      <div class="flex items-center gap-2 mb-5 flex-wrap">
        <div class="relative flex-1 max-w-md min-w-[240px]">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="text" placeholder="Buscar por descrição…"
                 class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        </div>
        <select v-model="categoryFilter"
                class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors">
          <option value="">Todas as categorias</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
        </select>
        <input type="date" v-model="startDate"
               class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        <input type="date" v-model="endDate"
               class="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <!-- Loading skeleton -->
        <div v-if="loading" class="p-1">
          <div v-for="i in 5" :key="`l${i}`"
               class="grid grid-cols-[100px_1.6fr_150px_130px_80px] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-16"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-48"></div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-24"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-12 justify-self-end"></div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="expenseList.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhuma despesa</div>
          <div class="text-xs text-slate-500 mb-4 max-w-xs">
            {{ search || categoryFilter || startDate || endDate ? 'Nenhuma despesa bate com esses filtros.' : 'Registre a primeira despesa pra começar o controle.' }}
          </div>
          <button v-if="search || categoryFilter || startDate || endDate || perms.can.create('expenses')" @click="openModal()" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">
            {{ search || categoryFilter || startDate || endDate ? 'Limpar filtros' : 'Criar primeira despesa' }}
          </button>
        </div>

        <!-- Lista -->
        <div v-else>
          <div class="grid grid-cols-[100px_1.6fr_150px_130px_80px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Data</span>
            <span>Descrição</span>
            <span>Categoria</span>
            <span class="text-right">Valor</span>
            <span class="text-right">Ações</span>
          </div>

          <div v-for="expense in expenseList" :key="expense.id"
               class="grid grid-cols-[100px_1.6fr_150px_130px_80px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group text-sm">
            <span class="text-xs text-slate-500">{{ new Date(expense.date).toLocaleDateString('pt-BR') }}</span>
            <span class="text-slate-900 truncate">{{ expense.description }}</span>
            <span>
              <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {{ expense.category || 'Sem categoria' }}
              </span>
            </span>
            <span class="text-right font-medium" style="color:#A32D2D">&minus; R$ {{ expense.amount.toFixed(2) }}</span>
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="perms.can.edit('expenses')" @click="openModal(expense)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Editar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="perms.can.delete('expenses')" @click="deleteExpense(expense.id)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
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

    <!-- Modal despesa -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showModal = false"></div>
        <div class="bg-white w-full max-w-md rounded-2xl border border-slate-200 relative z-10 flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-medium text-slate-900">{{ editingExpense ? 'Editar despesa' : 'Nova despesa' }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">Registre custos fixos e variáveis</p>
            </div>
            <button @click="showModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form @submit.prevent="saveExpense" class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Descrição *</label>
              <input v-model="form.description" type="text" required placeholder="Ex: aluguel de março"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Valor (R$) *</label>
                <input v-model.number="form.amount" type="number" step="0.01" required
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-slate-400 transition-colors"
                       style="color:#A32D2D">
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Data *</label>
                <input v-model="form.date" type="date" required
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Categoria</label>
              <select v-model="form.category"
                      class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                <option v-for="cat in categories" :key="cat.id" :value="cat.name">{{ cat.name }}</option>
              </select>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Fornecedor (opcional)</label>
              <select v-model="form.supplierId"
                      class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                <option :value="null">Nenhum</option>
                <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
          </form>

          <div class="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="showModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="saveExpense"
                    :disabled="!form.description || !form.amount"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {{ editingExpense ? 'Atualizar' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal categorias -->
    <Teleport to="body">
      <div v-if="showCategoryModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showCategoryModal = false"></div>
        <div class="bg-white w-full max-w-md rounded-2xl border border-slate-200 relative z-10 flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-medium text-slate-900">Categorias</h3>
              <p class="text-xs text-slate-500 mt-0.5">Organize suas despesas por tipo</p>
            </div>
            <button @click="showCategoryModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div class="flex gap-2 mb-5">
              <input v-model="newCategoryName" @keyup.enter="addCategory" placeholder="Nome da categoria…"
                     class="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              <button @click="addCategory"
                      :disabled="!newCategoryName"
                      class="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-40">
                Adicionar
              </button>
            </div>

            <div v-if="categories.length === 0" class="text-center py-8 text-xs text-slate-400">
              Nenhuma categoria criada
            </div>

            <div v-else class="space-y-1.5">
              <div v-for="cat in categories" :key="cat.id"
                   class="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group">
                <span class="text-sm text-slate-900">{{ cat.name }}</span>
                <button v-if="perms.can.delete('expenses')" @click="deleteCategory(cat.id)"
                        class="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="px-6 py-4 border-t border-slate-100 shrink-0">
            <button @click="showCategoryModal = false"
                    class="w-full py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
