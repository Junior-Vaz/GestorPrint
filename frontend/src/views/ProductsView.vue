<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { usePermissionsStore } from '../stores/permissions'
import PaginationControls from '../components/shared/PaginationControls.vue'

const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()
const perms = usePermissionsStore()

// Stock adjustment modal state
const stockModal = ref(false)
const stockProduct = ref<Product | null>(null)
const stockQty = ref('')
const stockSaving = ref(false)

const ESTIMATE_TYPE_OPTIONS = [
  { v: 'service', label: 'Serviço' },
  { v: 'plotter', label: 'Plotter' },
  { v: 'cutting', label: 'Recorte' },
  { v: 'embroidery', label: 'Estamparia' },
]

interface ProductType {
 id: number
 name: string
 color: string
 hasStock: boolean
 applicableEstimateTypes?: string[]
 _count?: { products: number }
}

interface Product {
 id: number
 name: string
 typeId: number
 productType: ProductType
 unit: string
 unitPrice: number
 brand: string | null
 markup: number
 stock: number
 minStock: number
 description: string | null
 supplier?: { id: number; name: string } | null
}

interface Supplier { id: number; name: string }

const productList = ref<Product[]>([])
const productTypes = ref<ProductType[]>([])
const supplierOptions = ref<Supplier[]>([])
const loading = ref(true)
const activeTab = ref<number | null>(null)
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(0)
const search = ref('')
const showProductModal = ref(false)
const showTypeModal = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const editingTypeId = ref<number | null>(null)

const form = ref({
 name: '', typeId: 0, unitPrice: 0, unit: 'un',
 brand: '', markup: 0, stock: 0, minStock: 0,
 description: '', supplierId: null as number | null
})

const typeForm = ref({ name: '', color: '#6366f1', hasStock: true, applicableEstimateTypes: [] as string[] })

const toggleEstimateType = (v: string) => {
  const arr = typeForm.value.applicableEstimateTypes
  const idx = arr.indexOf(v)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(v)
}

// --- Computed ---
const filteredProducts = computed(() => {
 if (activeTab.value === null) return productList.value
 return productList.value.filter((p: Product) => p.typeId === activeTab.value)
})

const lowStockCount = computed(() =>
 productList.value.filter((p: Product) => p.productType.hasStock && p.stock <= p.minStock).length
)

// --- Data fetch ---
const fetchProducts = async () => {
 loading.value = true
 try {
 const params = new URLSearchParams({ page: String(page.value), limit: String(limit.value) })
 if (search.value) params.set('search', search.value)
 if (activeTab.value !== null) params.set('type', String(activeTab.value))
 const res = await apiFetch(`/api/products?${params}`)
 if (!res.ok) return
 const result = await res.json()
 if (Array.isArray(result)) {
 productList.value = result; total.value = result.length; totalPages.value = 1
 } else {
 productList.value = result.data; total.value = result.total; totalPages.value = result.totalPages
 }
 } catch (e) { console.error(e) }
 finally { loading.value = false }
}

const fetchAll = async () => {
 // product-types e suppliers só são usados no modal de cadastro/edição.
 // Pra user view-only (PRODUCTION), pular essas chamadas evita 403 +
 // popup "Recurso não disponível" sem perder funcionalidade — o select
 // fica vazio mas o modal nem abre.
 const canMutate = perms.can.create('products') || perms.can.edit('products')
 const requests: Array<Promise<Response> | null> = [
   canMutate ? apiFetch('/api/product-types') : null,
   canMutate && perms.can.view('suppliers') ? apiFetch('/api/suppliers') : null,
 ]
 const [tRes, sRes] = await Promise.all(
   requests.map(r => r ?? Promise.resolve(null as any)),
 )
 if (tRes?.ok) productTypes.value = await tRes.json()
 if (sRes?.ok) supplierOptions.value = await sRes.json()
 await fetchProducts()
}

const debouncedSearch = useDebounceFn(() => { page.value = 1; fetchProducts() }, 300)
watch(search, debouncedSearch)
watch([page, limit], fetchProducts)
watch(activeTab, () => { page.value = 1; fetchProducts() })

// --- Product CRUD ---
const openProductModal = (product?: Product) => {
 if (product) {
 isEditing.value = true; editingId.value = product.id
 form.value = {
 name: product.name, typeId: product.typeId,
 unitPrice: product.unitPrice, unit: product.unit,
 brand: product.brand || '', markup: product.markup,
 stock: product.stock, minStock: product.minStock,
 description: product.description || '',
 supplierId: product.supplier?.id ?? null
 }
 } else {
 isEditing.value = false; editingId.value = null
 form.value = { name: '', typeId: productTypes.value[0]?.id ?? 0, unitPrice: 0, unit: 'un', brand: '', markup: 0, stock: 0, minStock: 0, description: '', supplierId: null as number | null }
 }
 showProductModal.value = true
}

const saveProduct = async () => {
 if (!form.value.name || !form.value.typeId || form.value.unitPrice <= 0) return
 const method = isEditing.value ? 'PATCH' : 'POST'
 const url = isEditing.value
 ? `/api/products/${editingId.value}`
 : '/api/products'
 const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form.value) })
 if (res.ok) { showProductModal.value = false; await fetchAll() }
}

const deleteProduct = async (id: number) => {
 if (!await confirmDialog('Excluir este insumo?', { title: 'Excluir insumo' })) return
 await apiFetch(`/api/products/${id}`, { method: 'DELETE' })
 await fetchAll()
}

// --- Type CRUD ---
const openTypeModal = (type?: ProductType) => {
 if (type) {
 editingTypeId.value = type.id
 typeForm.value = { name: type.name, color: type.color, hasStock: type.hasStock, applicableEstimateTypes: [...(type.applicableEstimateTypes || [])] }
 } else {
 editingTypeId.value = null
 typeForm.value = { name: '', color: '#6366f1', hasStock: true, applicableEstimateTypes: ['service', 'plotter', 'cutting', 'embroidery'] }
 }
 showTypeModal.value = true
}

const saveType = async () => {
 if (!typeForm.value.name) return
 const method = editingTypeId.value ? 'PATCH' : 'POST'
 const url = editingTypeId.value
 ? `/api/product-types/${editingTypeId.value}`
 : '/api/product-types'
 const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(typeForm.value) })
 if (res.ok) { showTypeModal.value = false; await fetchAll() }
}

const deleteType = async (id: number) => {
 if (!await confirmDialog('Excluir este tipo?', { title: 'Excluir tipo' })) return
 const res = await apiFetch(`/api/product-types/${id}`, { method: 'DELETE' })
 if (!res.ok) { const e = await res.json(); showToast(e.message || 'Erro ao excluir.', 'error') }
 await fetchAll()
}

// --- Stock adjustment modal ---
const openStockModal = (product: Product) => {
 stockProduct.value = product
 stockQty.value = ''
 stockModal.value = true
}

const confirmStockAdjust = async () => {
 const qty = parseFloat(stockQty.value)
 if (isNaN(qty) || qty === 0) {
 showToast('Informe um valor válido (ex: 10 ou -5).', 'warning')
 return
 }
 stockSaving.value = true
 await apiFetch(`/api/products/${stockProduct.value!.id}/stock`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ quantity: qty, type: qty > 0 ? 'PURCHASE' : 'ADJUSTMENT', reason: 'Ajuste manual' })
 })
 stockSaving.value = false
 stockModal.value = false
 await fetchAll()
}

onMounted(fetchAll)
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Header + CTAs -->
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900">Insumos & serviços</div>
          <div class="text-xs text-slate-500 mt-0.5">
            <span v-if="total > 0">{{ total }} {{ total === 1 ? 'item cadastrado' : 'itens cadastrados' }}</span>
            <span v-else>Nenhum insumo cadastrado ainda</span>
            <span v-if="lowStockCount > 0" class="ml-2" style="color:#A32D2D">&bull; {{ lowStockCount }} com estoque baixo</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button v-if="perms.can.create('products')" @click="openTypeModal()"
                  class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z"/></svg>
            Tipos
          </button>
          <button v-if="perms.can.create('products')" @click="openProductModal()"
                  class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2.5 transition-colors">
            <span class="text-base leading-none">+</span>
            Novo insumo
          </button>
        </div>
      </div>

      <!-- Busca + filtros de tipo -->
      <div class="flex items-center gap-3 mb-5 flex-wrap">
        <div class="relative flex-1 max-w-md">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="text" placeholder="Buscar por nome, marca ou descrição…"
                 class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"/>
        </div>
      </div>

      <!-- Tabs por tipo -->
      <div class="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
        <button
          @click="activeTab = null"
          :class="['shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-colors border',
            activeTab === null
              ? 'bg-slate-900 text-white border-slate-900 font-medium'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50']"
        >
          Todos
        </button>
        <button
          v-for="type in productTypes" :key="type.id"
          @click="activeTab = type.id"
          :class="['shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-colors border',
            activeTab === type.id
              ? 'bg-slate-900 text-white border-slate-900 font-medium'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50']"
        >
          <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: type.color }"></span>
          {{ type.name }}
          <span class="text-slate-400" :class="{ 'text-white/60': activeTab === type.id }">{{ type._count?.products ?? 0 }}</span>
        </button>
      </div>

      <!-- Tabela -->
      <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <!-- Loading skeleton -->
        <div v-if="loading" class="p-1">
          <div v-for="i in 5" :key="`l${i}`"
               class="grid grid-cols-[1.8fr_1fr_120px_130px_80px_90px] gap-4 items-center py-4 px-5 border-b border-slate-100 last:border-0">
            <div class="space-y-1.5 min-w-0">
              <div class="h-3 bg-slate-100 rounded animate-pulse w-40"></div>
              <div class="h-2.5 bg-slate-50 rounded animate-pulse w-32"></div>
            </div>
            <div class="h-5 bg-slate-100 rounded-full animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-16"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-20"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-10"></div>
            <div class="h-3 bg-slate-100 rounded animate-pulse w-14 justify-self-end"></div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredProducts.length === 0" class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <div class="text-sm font-medium text-slate-900 mb-1">Nenhum item</div>
          <div class="text-xs text-slate-500 mb-4 max-w-xs">
            {{ search ? 'Nada bate com essa busca.' : 'Cadastre o primeiro insumo para começar.' }}
          </div>
          <button v-if="search || perms.can.create('products')" @click="openProductModal()" class="text-xs font-medium text-slate-900 underline underline-offset-4 hover:no-underline">
            {{ search ? 'Limpar busca' : 'Criar primeiro insumo' }}
          </button>
        </div>

        <!-- Lista -->
        <div v-else>
          <div class="grid grid-cols-[1.8fr_1fr_120px_130px_80px_90px] gap-4 text-[11px] text-slate-400 px-5 py-3 border-b border-slate-200 bg-slate-50">
            <span>Insumo</span>
            <span>Tipo</span>
            <span>Estoque</span>
            <span>Preço base</span>
            <span>Margem</span>
            <span class="text-right">Ações</span>
          </div>

          <div
            v-for="product in filteredProducts" :key="product.id"
            class="grid grid-cols-[1.8fr_1fr_120px_130px_80px_90px] gap-4 items-center py-3.5 px-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium text-slate-900 truncate">{{ product.name }}</div>
              <div class="text-xs text-slate-400 truncate">
                {{ product.brand ? product.brand + ' · ' : '' }}{{ product.description || 'sem descrição' }}
              </div>
              <div v-if="product.supplier" class="text-[11px] text-slate-500 mt-0.5 truncate">
                Fornecedor: <span class="text-slate-700">{{ product.supplier.name }}</span>
              </div>
            </div>

            <div>
              <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                    :style="{ backgroundColor: product.productType.color + '22', color: product.productType.color }">
                <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: product.productType.color }"></span>
                {{ product.productType.name }}
              </span>
            </div>

            <div class="min-w-0">
              <template v-if="product.productType.hasStock">
                <div class="flex items-center gap-1.5">
                  <span :class="['text-sm font-medium', product.stock <= product.minStock ? 'text-red-600' : 'text-slate-900']">
                    {{ product.stock }}
                  </span>
                  <span class="text-[11px] text-slate-400">{{ product.unit }}</span>
                </div>
                <div class="text-[11px] text-slate-400">mín {{ product.minStock }}</div>
              </template>
              <span v-else class="text-xs text-slate-400">—</span>
            </div>

            <div>
              <div class="text-sm font-medium text-slate-900">R$ {{ product.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</div>
              <div class="text-[11px] text-slate-400">por {{ product.unit }}</div>
            </div>

            <div>
              <span v-if="product.markup > 0" class="text-sm" style="color:#1D9E75">+{{ product.markup }}%</span>
              <span v-else class="text-xs text-slate-400">—</span>
            </div>

            <div class="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="product.productType.hasStock && perms.can.edit('products')" @click="openStockModal(product)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Ajustar estoque">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
              </button>
              <button v-if="perms.can.edit('products')" @click="openProductModal(product)"
                      class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Editar">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button v-if="perms.can.delete('products')" @click="deleteProduct(product.id)"
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

    <!-- Product Modal -->
    <Teleport to="body">
      <div v-if="showProductModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showProductModal = false"></div>
        <div class="bg-white w-full max-w-xl rounded-2xl border border-slate-200 relative z-10 flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-medium text-slate-900">{{ isEditing ? 'Editar insumo' : 'Novo insumo' }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">Dados do insumo, estoque e preço</p>
            </div>
            <button @click="showProductModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form @submit.prevent="saveProduct" class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Nome *</label>
              <input v-model="form.name" required type="text" placeholder="Ex: Couchê 300g brilho"
                     class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Categoria *</label>
                <select v-model.number="form.typeId" required
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <option v-for="t in productTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Unidade</label>
                <select v-model="form.unit"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <option value="un">Unidade (un)</option>
                  <option value="m²">Metro² (m²)</option>
                  <option value="kg">Quilograma (kg)</option>
                  <option value="h">Hora (h)</option>
                  <option value="l">Litro (l)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Preço base (R$) *</label>
                <input v-model.number="form.unitPrice" required type="number" step="0.01"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Margem (%)</label>
                <input v-model.number="form.markup" type="number" step="1" placeholder="0"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Estoque atual</label>
                <input v-model.number="form.stock" type="number" step="0.1"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Estoque mínimo</label>
                <input v-model.number="form.minStock" type="number" step="0.1"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Marca</label>
                <input v-model="form.brand" type="text" placeholder="Ex: Suzano, IP…"
                       class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Fornecedor</label>
                <select v-model.number="form.supplierId"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                  <option :value="null">Nenhum</option>
                  <option v-for="s in supplierOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Descrição</label>
              <textarea v-model="form.description" rows="2" placeholder="Observações adicionais…"
                        class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors resize-none"></textarea>
            </div>
          </form>

          <div class="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="showProductModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="saveProduct"
                    :disabled="!form.name || !form.typeId || form.unitPrice <= 0"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {{ isEditing ? 'Atualizar' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Type Manager Modal -->
    <Teleport to="body">
      <div v-if="showTypeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="showTypeModal = false"></div>
        <div class="bg-white w-full max-w-md rounded-2xl border border-slate-200 relative z-10 flex flex-col max-h-[90vh]">
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h3 class="text-base font-medium text-slate-900">Categorias</h3>
              <p class="text-xs text-slate-500 mt-0.5">Organize insumos por tipo</p>
            </div>
            <button @click="showTypeModal = false" class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div class="space-y-1.5 mb-5">
              <div v-for="type in productTypes" :key="type.id"
                   class="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: type.color }"></span>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-slate-900 truncate">{{ type.name }}</div>
                    <div class="text-[11px] text-slate-400">
                      {{ type.hasStock ? 'com estoque' : 'sem estoque' }} · {{ type._count?.products ?? 0 }} {{ (type._count?.products ?? 0) === 1 ? 'item' : 'itens' }}
                    </div>
                  </div>
                </div>
                <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button v-if="perms.can.edit('products')" @click="openTypeModal(type)" class="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button v-if="perms.can.delete('products')" @click="deleteType(type.id)" class="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>

              <div v-if="productTypes.length === 0" class="text-center py-6 text-xs text-slate-400">
                Nenhuma categoria criada
              </div>
            </div>

            <div class="pt-4 border-t border-slate-100">
              <div class="text-xs text-slate-500 mb-2">{{ editingTypeId ? 'Editar tipo' : 'Novo tipo' }}</div>
              <div class="flex gap-2 mb-2">
                <input v-model="typeForm.name" type="text" placeholder="Nome do tipo…"
                       class="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors">
                <input v-model="typeForm.color" type="color"
                       class="w-10 h-10 rounded-md border border-slate-200 cursor-pointer p-0.5">
              </div>
              <label class="flex items-center gap-2 text-xs text-slate-600 mb-3 cursor-pointer">
                <input v-model="typeForm.hasStock" type="checkbox" class="w-3.5 h-3.5 rounded accent-slate-900">
                Controla estoque físico
              </label>

              <div class="mb-3">
                <div class="text-xs text-slate-500 mb-1.5">Aparece em quais calculadoras?</div>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="opt in ESTIMATE_TYPE_OPTIONS" :key="opt.v"
                    type="button" @click="toggleEstimateType(opt.v)"
                    :class="['px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                      typeForm.applicableEstimateTypes.includes(opt.v)
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
                    {{ opt.label }}
                  </button>
                </div>
                <p v-if="typeForm.applicableEstimateTypes.length === 0" class="text-[10px] mt-1.5" style="color:#A32D2D">
                  Nenhuma marcada = não aparece em nenhuma calculadora
                </p>
              </div>

              <button @click="saveType"
                      class="w-full py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">
                {{ editingTypeId ? 'Atualizar tipo' : 'Criar tipo' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Stock Adjustment Modal -->
    <Teleport to="body">
      <div v-if="stockModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="stockModal = false"></div>
        <div class="bg-white w-full max-w-sm rounded-2xl border border-slate-200 relative z-10 p-6">
          <div class="w-11 h-11 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
          </div>
          <h3 class="text-base font-medium text-slate-900 mb-1 text-center">Ajustar estoque</h3>
          <p v-if="stockProduct" class="text-sm text-slate-500 mb-5 text-center">
            <span class="text-slate-900 font-medium">{{ stockProduct.name }}</span>
            &nbsp;· atual {{ stockProduct.stock }} {{ stockProduct.unit }}
          </p>
          <label class="block text-xs text-slate-500 mb-1.5">Quantidade (use &minus; para saída)</label>
          <input v-model="stockQty" type="number" step="0.1" placeholder="Ex: 10 ou -5"
                 autofocus @keyup.enter="confirmStockAdjust"
                 class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors mb-5">
          <div class="flex gap-2">
            <button @click="stockModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button @click="confirmStockAdjust" :disabled="stockSaving"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {{ stockSaving ? 'Salvando…' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
