<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useConfirm } from '../composables/useConfirm'
import { usePermissionsStore } from '../stores/permissions'
import PaginationControls from '../components/shared/PaginationControls.vue'

const { confirm: confirmDialog } = useConfirm()
const perms = usePermissionsStore()

const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')

interface Supplier {
 id: number
 name: string
 email: string | null
 phone: string | null
 category: string | null
 address: string | null
 createdAt: string
}

const supplierList = ref<Supplier[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingSupplier = ref<Supplier | null>(null)

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
 loading.value = true
 try {
 const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
 if (search.value) params.set('search', search.value)
 const res = await apiFetch(`/api/suppliers?${params}`)
 if (!res.ok) return
 const result = await res.json()
 if (Array.isArray(result)) {
 supplierList.value = result; total.value = result.length; totalPages.value = 1
 } else {
 supplierList.value = result.data; total.value = result.total; totalPages.value = result.totalPages
 }
 } catch (e) {
 console.error('Failed to fetch suppliers', e)
 } finally {
 loading.value = false
 }
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchSuppliers() }, 300)
watch(search, debouncedSearch)
watch([page, limit], fetchSuppliers)

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


onMounted(fetchSuppliers)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Fornecedores</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'fornecedor cadastrado' : 'fornecedores cadastrados' }}</span>
            <span v-else>Cadastre o primeiro fornecedor</span>
          </div>
        </div>
        <button v-if="perms.can.create('suppliers')" @click="openModal()"
                class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors">
          <span class="text-base leading-none">+</span>
          Novo fornecedor
        </button>
      </div>

      <!-- Busca -->
      <div class="relative mb-5 max-w-md">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" type="text" placeholder="Buscar por nome, e-mail ou telefone…"
               class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <!-- Loading -->
        <div v-if="loading" class="p-1">
          <div v-for="i in 5" :key="`l${i}`"
               class="grid grid-cols-[1.6fr_130px_1fr_1.2fr_80px] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
              <div class="space-y-1.5 min-w-0 flex-1">
                <div class="h-3 bg-slate-100 rounded animate-pulse w-32"></div>
                <div class="h-2.5 bg-slate-50 rounded animate-pulse w-40"></div>
              </div>
            </div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-28"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-24"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-12 justify-self-end"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="supplierList.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhum fornecedor</div>
          <div class="text-xs text-slate-500 mb-4 max-w-xs">
            {{ search ? 'Nada bate com essa busca.' : 'Cadastre o primeiro fornecedor pra associar a insumos e contas.' }}
          </div>
          <button v-if="search || perms.can.create('suppliers')" @click="openModal()" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">
            {{ search ? 'Limpar busca' : 'Criar primeiro fornecedor' }}
          </button>
        </div>

        <!-- Lista -->
        <div v-else>
          <div class="grid grid-cols-[1.6fr_130px_1fr_1.2fr_80px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Fornecedor</span>
            <span>Categoria</span>
            <span>Telefone</span>
            <span>Endereço</span>
            <span class="text-right">Ações</span>
          </div>

          <div
            v-for="supplier in supplierList" :key="supplier.id"
            class="grid grid-cols-[1.6fr_130px_1fr_1.2fr_80px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group text-sm"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-9 h-9 rounded-full bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center shrink-0">
                {{ (supplier.name || '??').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') }}
              </span>
              <div class="min-w-0">
                <div class="text-slate-900 font-medium truncate">{{ supplier.name }}</div>
                <div class="text-xs text-slate-400 truncate">{{ supplier.email || 'Sem e-mail' }}</div>
              </div>
            </div>
            <span>
              <span v-if="supplier.category" class="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {{ supplier.category }}
              </span>
              <span v-else class="text-xs text-slate-400">—</span>
            </span>
            <span class="text-slate-600 truncate">{{ supplier.phone || '—' }}</span>
            <span class="text-slate-600 truncate">{{ supplier.address || '—' }}</span>
            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="perms.can.edit('suppliers')" @click="openModal(supplier)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Editar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="perms.can.delete('suppliers')" @click="deleteSupplier(supplier.id)"
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

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showModal = false"></div>
        <div class="bg-white w-full max-w-md rounded-2xl border border-slate-200 relative z-10 flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-medium text-slate-900">{{ editingSupplier ? 'Editar fornecedor' : 'Novo fornecedor' }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">Contato e localização</p>
            </div>
            <button @click="showModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form @submit.prevent="saveSupplier" class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Nome *</label>
              <input v-model="form.name" type="text" required placeholder="Ex: Gráfica Central"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Telefone</label>
                <input v-model="form.phone" type="text" placeholder="(11) 99999-0000"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Categoria</label>
                <select v-model="form.category"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">E-mail</label>
              <input v-model="form.email" type="email" placeholder="contato@fornecedor.com"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Endereço</label>
              <input v-model="form.address" type="text" placeholder="Rua, número, bairro, cidade…"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>
          </form>

          <div class="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="showModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="saveSupplier" :disabled="!form.name"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {{ editingSupplier ? 'Atualizar' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
