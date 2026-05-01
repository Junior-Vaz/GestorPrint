<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import { usePermissionsStore } from '../../stores/permissions'
import PaginationControls from '../../components/shared/PaginationControls.vue'
import RichTextEditor from '../../components/shared/RichTextEditor.vue'

const { showToast } = useToast()
const perms = usePermissionsStore()

interface Product {
  id: number
  name: string
  unitPrice: number
  unit: string
  stock: number
  minStock: number
  visibleInStore: boolean
  slug?: string | null
  photos?: string[]
  shortDescription?: string | null
  longDescription?: string | null
  storeOrder?: number
  weightGrams?: number | null
  heightCm?: number | null
  widthCm?: number | null
  lengthCm?: number | null
  pixDiscountPercent?: number | null
  originalPrice?: number | null
  productionDays?: number | null
  storePrice?: number | null
  productType: { id: number; name: string; color: string; visibleInStore: boolean }
}

interface Category {
  id: number
  name: string
  color: string
  visibleInStore: boolean
  storeOrder: number
  storeIcon?: string | null
  visibleProductCount?: number
}

const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref<'all' | 'visible' | 'hidden'>('all')
const activeTab = ref<'products' | 'categories'>('products')

// Paginação server-side. Default 50 itens — admin tipicamente quer ver bastante
// produto de uma vez (mesmo numa loja com 500+ produtos), e a tabela tem
// scroll horizontal embutido. Filtros (search/status) são client-side dentro
// da página atual.
const page = ref(1)
const pageSize = ref(50)
const totalProducts = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalProducts.value / pageSize.value)))

// Modal
const editing = ref<Product | null>(null)
const editForm = ref({
  visibleInStore: false,
  slug: '',
  shortDescription: '',
  longDescription: '',
  photos: [] as string[],
  weightGrams: 0,
  heightCm: 0,
  widthCm: 0,
  lengthCm: 0,
  pixDiscountPercent: 0,
  originalPrice: 0,        // 0 = sem promoção
  productionDays: 0,       // 0 = pronta-entrega
  storePrice: 0,           // 0 = usa o preço interno padrão
})
const saving = ref(false)
const newPhotoUrl = ref('')

const fetchProducts = async () => {
  loading.value = true
  try {
    const [pRes, cRes] = await Promise.all([
      apiFetch(`/api/ecommerce/admin/products?page=${page.value}&pageSize=${pageSize.value}`),
      apiFetch('/api/ecommerce/admin/categories'),
    ])
    if (pRes.ok) {
      const json = await pRes.json()
      // Backward compat: aceita array (legado) ou envelope paginado
      if (Array.isArray(json)) {
        products.value = json
        totalProducts.value = json.length
      } else {
        products.value = json.data || []
        totalProducts.value = json.total || 0
      }
    }
    if (cRes.ok) categories.value = await cRes.json()
  } finally { loading.value = false }
}

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchProducts()
}

// Edição do ícone SVG (categorias em destaque na home)
const editingCategory = ref<Category | null>(null)
const iconDraft = ref('')

const openCategoryIcon = (c: Category) => {
  editingCategory.value = c
  iconDraft.value = c.storeIcon || ''
}
const closeCategoryIcon = () => { editingCategory.value = null }
const saveCategoryIcon = async () => {
  if (!editingCategory.value) return
  try {
    const res = await apiFetch(`/api/ecommerce/admin/categories/${editingCategory.value.id}/store`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeIcon: iconDraft.value || null }),
    })
    if (res.ok) {
      editingCategory.value.storeIcon = iconDraft.value
      showToast('Ícone salvo', 'success')
      closeCategoryIcon()
    }
  } catch { showToast('Erro ao salvar ícone', 'error') }
}

const toggleCategoryVisible = async (c: Category) => {
  const newVal = !c.visibleInStore
  try {
    const res = await apiFetch(`/api/ecommerce/admin/categories/${c.id}/store`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleInStore: newVal }),
    })
    if (res.ok) {
      c.visibleInStore = newVal
      // Atualiza a referência no products também
      products.value.forEach(p => {
        if (p.productType.id === c.id) p.productType.visibleInStore = newVal
      })
      showToast(newVal ? 'Categoria visível na loja' : 'Categoria oculta', 'success')
    }
  } catch {
    showToast('Erro ao atualizar', 'error')
  }
}

const visibleCount = computed(() => products.value.filter(p => p.visibleInStore).length)
const hiddenCount = computed(() => products.value.filter(p => !p.visibleInStore).length)
const orphanCount = computed(() =>
  products.value.filter(p => p.visibleInStore && !p.productType.visibleInStore).length,
)
// Produtos com estoque ≤ minStock (e minStock > 0 — sem isso não é alerta, é só "sem controle")
const lowStockProducts = computed(() =>
  products.value.filter(p => p.minStock > 0 && p.stock <= p.minStock)
)
const isLowStock = (p: Product) => p.minStock > 0 && p.stock <= p.minStock
const isOutOfStock = (p: Product) => p.stock <= 0

const filtered = computed(() => {
  let arr = products.value
  if (filterStatus.value === 'visible') arr = arr.filter(p => p.visibleInStore)
  if (filterStatus.value === 'hidden') arr = arr.filter(p => !p.visibleInStore)
  if (search.value) {
    const q = search.value.toLowerCase()
    arr = arr.filter(p => p.name.toLowerCase().includes(q))
  }
  return arr
})

const toggleVisible = async (p: Product) => {
  const newVal = !p.visibleInStore
  try {
    const res = await apiFetch(`/api/ecommerce/admin/products/${p.id}/store`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleInStore: newVal }),
    })
    if (res.ok) {
      p.visibleInStore = newVal
      const data = await res.json()
      if (data.slug) p.slug = data.slug
      showToast(newVal ? 'Produto na loja' : 'Removido da loja', 'success')
    }
  } catch {
    showToast('Erro ao atualizar', 'error')
  }
}

const openEdit = (p: Product) => {
  editing.value = p
  editForm.value = {
    visibleInStore: p.visibleInStore,
    slug: p.slug || '',
    shortDescription: p.shortDescription || '',
    // BUG FIX: antes hardcoded como '' — descartava o valor existente do produto
    // e ao salvar gravava em branco. Agora carrega do produto.
    longDescription: p.longDescription || '',
    photos: [...(p.photos || [])],
    weightGrams: p.weightGrams || 0,
    heightCm: p.heightCm || 0,
    widthCm: p.widthCm || 0,
    lengthCm: p.lengthCm || 0,
    pixDiscountPercent: Number(p.pixDiscountPercent ?? 0),
    originalPrice:      Number(p.originalPrice ?? 0),
    productionDays:     Number(p.productionDays ?? 0),
    storePrice:         Number(p.storePrice ?? 0),
  }
  newPhotoUrl.value = ''
}

const closeEdit = () => { editing.value = null; activeModalTab.value = 'geral' }

// Tabs do modal de edit. "Geral" tem campos curtos (visibilidade, descrição
// curta, fotos, dimensões); "Descrição" dedica todo o espaço pro RichTextEditor.
const activeModalTab = ref<'geral' | 'descricao'>('geral')

const addPhoto = () => {
  const url = newPhotoUrl.value.trim()
  if (!url) return
  editForm.value.photos.push(url)
  newPhotoUrl.value = ''
}

const removePhoto = (i: number) => {
  editForm.value.photos.splice(i, 1)
}

const saveEdit = async () => {
  if (!editing.value) return
  saving.value = true
  try {
    // storePrice: 0 ou vazio = null (usa preço interno padrão)
    const payload = {
      ...editForm.value,
      storePrice: editForm.value.storePrice > 0 ? editForm.value.storePrice : null,
    }
    const res = await apiFetch(`/api/ecommerce/admin/products/${editing.value.id}/store`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      showToast('Salvo!', 'success')
      await fetchProducts()
      closeEdit()
    } else {
      showToast('Erro ao salvar', 'error')
    }
  } finally { saving.value = false }
}

const formatCurrency = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

onMounted(fetchProducts)
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Catálogo da loja</h1>
        <p class="text-sm text-slate-500 mt-1">Escolha quais produtos ficam visíveis na sua vitrine online</p>
      </div>
      <div class="relative">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input v-model="search" type="text" placeholder="Buscar produto..."
          class="pl-9 pr-3 py-2 w-64 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 transition-colors" />
      </div>
    </div>

    <!-- Alerta de estoque crítico -->
    <div v-if="lowStockProducts.length" class="border border-red-200 bg-red-50 rounded-xl p-4 flex items-start gap-3">
      <svg class="w-5 h-5 mt-0.5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <div class="flex-1">
        <div class="text-sm font-medium text-red-900">
          {{ lowStockProducts.length }} produto{{ lowStockProducts.length !== 1 ? 's' : '' }} com estoque crítico
        </div>
        <div class="text-xs text-red-700 mt-0.5">
          Estoque ≤ mínimo definido. Reponha pra evitar perda de venda.
          <span class="font-mono">{{ lowStockProducts.slice(0, 3).map(p => p.name).join(' · ') }}{{ lowStockProducts.length > 3 ? ' …' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Total cadastrado</div>
        <div class="text-2xl font-medium text-slate-900 mt-1">{{ products.length }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Visíveis na loja</div>
        <div class="text-2xl font-medium mt-1" style="color:#1D9E75">{{ visibleCount }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5" :style="orphanCount > 0 ? { borderColor:'#FCEBEB' } : {}">
        <div class="text-xs text-slate-500">Categoria oculta</div>
        <div class="text-2xl font-medium mt-1" :style="{ color: orphanCount > 0 ? '#A32D2D' : '#475569' }">{{ orphanCount }}</div>
        <div class="text-[11px] text-slate-400 mt-1" v-if="orphanCount > 0">produtos visíveis cuja categoria está oculta</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5" :style="lowStockProducts.length > 0 ? { borderColor:'#FCEBEB' } : {}">
        <div class="text-xs text-slate-500">Estoque crítico</div>
        <div class="text-2xl font-medium mt-1" :style="{ color: lowStockProducts.length > 0 ? '#A32D2D' : '#475569' }">{{ lowStockProducts.length }}</div>
        <div class="text-[11px] text-slate-400 mt-1" v-if="lowStockProducts.length > 0">produtos abaixo do mínimo</div>
      </div>
    </div>

    <!-- Tabs Produtos / Categorias -->
    <div class="border-b border-slate-200 flex items-center gap-1">
      <button @click="activeTab = 'products'"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'products' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700']">
        Produtos
      </button>
      <button @click="activeTab = 'categories'"
        :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          activeTab === 'categories' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700']">
        Categorias
      </button>
    </div>

    <!-- Filtros (só na tab produtos) -->
    <div v-if="activeTab === 'products'" class="border border-slate-200 rounded-xl p-3 flex items-center gap-2">
      <span class="text-xs text-slate-500 ml-1">Status</span>
      <button v-for="f in [
        { v: 'all', l: 'Todos' },
        { v: 'visible', l: 'Visíveis' },
        { v: 'hidden', l: 'Ocultos' },
      ]" :key="f.v"
        @click="filterStatus = f.v as any"
        :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          filterStatus === f.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
        {{ f.l }}
      </button>
    </div>

    <!-- Tab Categorias -->
    <div v-if="activeTab === 'categories'" class="border border-slate-200 rounded-xl overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>
      <table v-else class="w-full text-left">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Categoria</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Produtos visíveis</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Ícone (home)</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500 text-center">Visível na loja</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in categories" :key="c.id" class="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
            <td class="px-5 py-3">
              <span class="inline-flex items-center gap-2 text-sm">
                <span class="w-2 h-2 rounded-full" :style="{ background: c.color }"></span>
                <span class="text-slate-900 font-medium">{{ c.name }}</span>
              </span>
            </td>
            <td class="px-5 py-3 text-sm text-slate-600">
              {{ c.visibleProductCount || 0 }}
              <span v-if="(c.visibleProductCount || 0) > 0 && !c.visibleInStore"
                class="ml-2 text-[10px] px-1.5 py-0.5 rounded" style="background:#FCEBEB; color:#A32D2D"
                title="Há produtos visíveis nessa categoria, mas a categoria está oculta">
                bloqueando produtos
              </span>
            </td>
            <td class="px-5 py-3">
              <button v-if="perms.can.edit('ecommerce-catalog')" @click="openCategoryIcon(c)"
                class="inline-flex items-center gap-2 text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5 transition-colors">
                <span v-if="c.storeIcon" class="w-5 h-5 inline-flex items-center justify-center" v-html="c.storeIcon"></span>
                <span v-else class="w-5 h-5 rounded bg-slate-100 inline-flex items-center justify-center text-slate-400 text-[10px]">∅</span>
                {{ c.storeIcon ? 'Editar' : 'Adicionar' }}
              </button>
            </td>
            <td class="px-5 py-3 text-center">
              <label class="relative inline-flex items-center cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': !perms.can.edit('ecommerce-catalog') }">
                <input type="checkbox" :checked="c.visibleInStore" :disabled="!perms.can.edit('ecommerce-catalog')" @change="toggleCategoryVisible(c)" class="sr-only peer" />
                <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </label>
            </td>
          </tr>
          <tr v-if="!loading && categories.length === 0">
            <td colspan="4" class="px-5 py-12 text-center text-sm text-slate-400">Nenhuma categoria cadastrada.</td>
          </tr>
        </tbody>
      </table>

      <!-- Modal de ícone -->
      <div v-if="editingCategory" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/40" @click="closeCategoryIcon"></div>
        <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
          <header class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-base font-medium text-slate-900">Ícone — {{ editingCategory.name }}</h3>
              <p class="text-xs text-slate-500 mt-0.5">SVG inline que aparece nos cards "Categorias em destaque" da home</p>
            </div>
            <button @click="closeCategoryIcon" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </header>

          <div class="p-6 space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Código SVG (cole aqui)</label>
              <textarea v-model="iconDraft" rows="8"
                placeholder='<svg width="80" height="70" viewBox="0 0 80 70" fill="none">...</svg>'
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-slate-400 resize-y"></textarea>
              <p class="text-[11px] text-slate-400 mt-1.5">
                Dica: pegue ícones em <a href="https://www.svgrepo.com" target="_blank" class="underline">svgrepo.com</a> ou
                <a href="https://heroicons.com" target="_blank" class="underline">heroicons.com</a>. Tamanho ideal: 80×70px.
              </p>
            </div>

            <div v-if="iconDraft">
              <div class="text-xs text-slate-500 mb-2">Pré-visualização</div>
              <div class="border border-slate-200 rounded-lg p-6 flex items-center justify-center bg-slate-50">
                <div class="w-20 h-20 flex items-center justify-center" v-html="iconDraft"></div>
              </div>
            </div>
          </div>

          <footer class="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
            <button @click="closeCategoryIcon" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
            <button v-if="perms.can.edit('ecommerce-catalog')" @click="saveCategoryIcon"
              class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-5 py-2 transition-colors">
              Salvar ícone
            </button>
          </footer>
        </div>
      </div>
    </div>

    <!-- Tabela Produtos -->
    <div v-if="activeTab === 'products'" class="border border-slate-200 rounded-xl overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="px-5 py-3 text-xs font-medium text-slate-500 w-16">Foto</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Produto</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Categoria</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Preço</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500">Estoque</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500 text-center">Visível</th>
              <th class="px-5 py-3 text-xs font-medium text-slate-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filtered" :key="p.id" class="border-b border-slate-100 hover:bg-slate-50/60 transition-colors group">
              <td class="px-5 py-3">
                <div class="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                  <img v-if="p.photos && p.photos.length" :src="p.photos[0]" alt="" class="w-full h-full object-cover" />
                  <svg v-else class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
              </td>
              <td class="px-5 py-3">
                <div class="text-sm font-medium text-slate-900">{{ p.name }}</div>
                <div v-if="p.slug" class="text-[11px] text-slate-400 font-mono">/{{ p.slug }}</div>
              </td>
              <td class="px-5 py-3">
                <span class="inline-flex items-center gap-1.5 text-xs">
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ background: p.productType.color }"></span>
                  <span class="text-slate-700">{{ p.productType.name }}</span>
                  <span v-if="p.visibleInStore && !p.productType.visibleInStore"
                    class="ml-1 text-[10px] px-1.5 py-0.5 rounded" style="background:#FCEBEB; color:#A32D2D"
                    title="Categoria oculta — produto não vai aparecer">
                    cat. oculta
                  </span>
                </span>
              </td>
              <td class="px-5 py-3 text-sm text-slate-900">{{ formatCurrency(p.unitPrice) }}</td>
              <td class="px-5 py-3 text-sm">
                <span :style="{ color: isOutOfStock(p) ? '#A32D2D' : isLowStock(p) ? '#92400E' : '#0F6E56' }">{{ p.stock }} {{ p.unit }}</span>
                <span v-if="isOutOfStock(p)"
                  class="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium" style="background:#FEE2E2;color:#A32D2D"
                  title="Sem estoque — bloqueia compra na loja se 'blockOutOfStock' estiver ativo">
                  ZERADO
                </span>
                <span v-else-if="isLowStock(p)"
                  class="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium" style="background:#FEF3C7;color:#92400E"
                  :title="`Estoque ≤ mínimo (${p.minStock} ${p.unit})`">
                  CRÍTICO
                </span>
              </td>
              <td class="px-5 py-3 text-center">
                <label class="relative inline-flex items-center cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': !perms.can.edit('ecommerce-catalog') }">
                  <input type="checkbox" :checked="p.visibleInStore" :disabled="!perms.can.edit('ecommerce-catalog')" @change="toggleVisible(p)" class="sr-only peer" />
                  <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </td>
              <td class="px-5 py-3 text-right">
                <button v-if="perms.can.edit('ecommerce-catalog')" @click="openEdit(p)"
                  class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5 transition-colors">
                  Editar loja
                </button>
              </td>
            </tr>
            <tr v-if="filtered.length === 0 && !loading">
              <td colspan="7" class="px-5 py-12 text-center text-sm text-slate-400">Nenhum produto encontrado.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginação — usa o componente compartilhado (mesmo padrão de Audit/Logs) -->
      <div v-if="!loading && totalProducts > 0" class="px-5 border-t border-slate-200">
        <PaginationControls
          :page="page"
          :total-pages="totalPages"
          :total="totalProducts"
          :limit="pageSize"
          @update:page="(p) => { page = p; fetchProducts() }"
          @update:limit="(n) => { pageSize = n; page = 1; fetchProducts() }"
        />
      </div>
    </div>

    <!-- Modal de edição — wide pra acomodar editor de descrição rico -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="closeEdit"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto z-10 flex flex-col">
        <header class="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 class="text-base font-medium text-slate-900">{{ editing.name }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Configurações da loja</p>
          </div>
          <button @click="closeEdit" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <!-- Tabs -->
        <div class="px-6 border-b border-slate-200 flex items-center gap-1 sticky top-[57px] bg-white z-10">
          <button
            type="button"
            @click="activeModalTab = 'geral'"
            :class="['px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px', activeModalTab === 'geral' ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-900']"
          >Geral</button>
          <button
            type="button"
            @click="activeModalTab = 'descricao'"
            :class="['px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px flex items-center gap-1.5', activeModalTab === 'descricao' ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-900']"
          >
            Descrição completa
            <span v-if="editForm.longDescription" class="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Há conteúdo cadastrado"></span>
          </button>
        </div>

        <!-- Aba Geral -->
        <div v-show="activeModalTab === 'geral'" class="p-6 space-y-5 flex-1">
          <!-- Visível + slug -->
          <div class="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div class="text-sm font-medium text-slate-900">Visível na loja</div>
              <div class="text-xs text-slate-500 mt-0.5">Cliente final consegue ver e comprar</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="editForm.visibleInStore" class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">URL (slug)</label>
            <div class="flex items-center gap-1">
              <span class="text-xs text-slate-400 font-mono">/produtos/</span>
              <input v-model="editForm.slug" type="text" placeholder="cartao-de-visita-100un"
                class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400 transition-colors" />
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Vazio = gerado automaticamente do nome</p>
          </div>

          <!-- Descrições -->
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Descrição curta (cards)</label>
            <input v-model="editForm.shortDescription" type="text" maxlength="200"
              placeholder="Cartão couché 250g · arte em 24h"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors" />
          </div>

          <!-- Descrição completa fica numa tab dedicada (mais espaço horizontal
               pro RichTextEditor). Pra editar, clica na aba "Descrição completa". -->

          <!-- Fotos -->
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Fotos (URLs)</label>
            <div class="flex items-center gap-2">
              <input v-model="newPhotoUrl" @keydown.enter.prevent="addPhoto" type="text" placeholder="https://exemplo.com/foto.jpg"
                class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors" />
              <button @click="addPhoto" type="button"
                class="text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg px-4 py-2 transition-colors">
                Adicionar
              </button>
            </div>
            <div v-if="editForm.photos.length" class="mt-3 grid grid-cols-4 gap-2">
              <div v-for="(url, i) in editForm.photos" :key="i" class="relative group/photo">
                <img :src="url" alt="" class="w-full h-20 object-cover rounded border border-slate-200" />
                <button @click="removePhoto(i)" type="button"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-slate-600 hover:text-red-600 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center text-xs">×</button>
              </div>
            </div>
            <p v-else class="text-[11px] text-slate-400 mt-2">Sem fotos. A primeira é usada como capa.</p>
          </div>

          <!-- Dimensões / frete -->
          <div>
            <p class="text-xs text-slate-500 mb-1.5">Dimensões embaladas (pra cálculo de frete)</p>
            <div class="grid grid-cols-4 gap-2">
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Peso (g)</label>
                <input v-model.number="editForm.weightGrams" type="number" min="0" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-400" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Altura (cm)</label>
                <input v-model.number="editForm.heightCm" type="number" min="0" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-400" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Largura (cm)</label>
                <input v-model.number="editForm.widthCm" type="number" min="0" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-400" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Comprimento (cm)</label>
                <input v-model.number="editForm.lengthCm" type="number" min="0" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-slate-400" />
              </div>
            </div>
          </div>

          <!-- Preço da loja — opcional, sobrescreve o preço interno na loja online -->
          <div class="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-slate-900">Preço na loja online <span class="text-xs font-normal text-slate-400">(opcional)</span></label>
              <span v-if="editing" class="text-[11px] text-slate-500">
                Preço interno: <span class="font-mono font-medium text-slate-700">R$ {{ editing.unitPrice.toFixed(2).replace('.', ',') }}</span>
              </span>
            </div>
            <p class="text-xs text-slate-500 mb-2">
              Use um preço diferente do preço interno padrão.
              Deixe <span class="font-mono">0</span> ou vazio pra usar o preço interno (R$ {{ editing?.unitPrice?.toFixed(2).replace('.', ',') ?? '0,00' }}).
            </p>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
              <input
                v-model.number="editForm.storePrice"
                type="number"
                min="0"
                step="0.01"
                class="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-400 bg-white"
                placeholder="Vazio = usar preço interno"
              />
            </div>
            <p v-if="editForm.storePrice > 0 && editing" class="text-xs mt-1.5"
              :class="editForm.storePrice > editing.unitPrice ? 'text-emerald-600' : editForm.storePrice < editing.unitPrice ? 'text-amber-600' : 'text-slate-500'">
              <span v-if="editForm.storePrice > editing.unitPrice">
                Loja R$ {{ editForm.storePrice.toFixed(2).replace('.', ',') }} · margem extra de R$ {{ (editForm.storePrice - editing.unitPrice).toFixed(2).replace('.', ',') }} sobre o preço interno
              </span>
              <span v-else-if="editForm.storePrice < editing.unitPrice">
                Loja R$ {{ editForm.storePrice.toFixed(2).replace('.', ',') }} · desconto de R$ {{ (editing.unitPrice - editForm.storePrice).toFixed(2).replace('.', ',') }} em relação ao preço interno
              </span>
              <span v-else>Loja com mesmo preço do interno.</span>
            </p>
          </div>

          <!-- Promoção & Produção — preço "de" e prazo de produção -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- Preço "de" — pra promoções honestas (mostra riscado na loja) -->
            <div class="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <label class="block text-sm font-medium text-slate-900 mb-1">Preço "de" <span class="text-xs font-normal text-slate-400">(promoção)</span></label>
              <p class="text-xs text-slate-500 mb-2">
                Se preencher, a loja mostra o preço atual com o "de" riscado ao lado.
                Use <span class="font-mono">0</span> pra esconder.
              </p>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">R$</span>
                <input
                  v-model.number="editForm.originalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-slate-400 bg-white"
                  placeholder="0,00"
                />
              </div>
              <p v-if="editForm.originalPrice > 0 && editing && editing.unitPrice && editForm.originalPrice <= editing.unitPrice" class="text-xs text-amber-600 mt-1.5">
                Precisa ser maior que R$ {{ editing.unitPrice.toFixed(2).replace('.', ',') }} (preço de venda atual).
              </p>
            </div>

            <!-- Dias úteis de produção (gráfica). 0 = pronta-entrega -->
            <div class="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <label class="block text-sm font-medium text-slate-900 mb-1">Prazo de produção</label>
              <p class="text-xs text-slate-500 mb-2">
                Dias úteis pra produzir antes de enviar. <span class="font-mono">0</span> = pronta-entrega.
              </p>
              <div class="relative">
                <input
                  v-model.number="editForm.productionDays"
                  type="number"
                  min="0"
                  max="60"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 pr-16 bg-white"
                  placeholder="0"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">dias úteis</span>
              </div>
            </div>
          </div>

          <!-- Desconto PIX por produto. 0 = sem desconto. Aplicado automaticamente
               no checkout quando o cliente escolhe PIX. -->
          <div class="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div class="flex items-start gap-4">
              <div class="flex-1">
                <label class="block text-sm font-medium text-slate-900">Desconto no PIX</label>
                <p class="text-xs text-slate-500 mt-0.5">
                  % de desconto aplicado ao escolher PIX no checkout. Cada produto pode ter um valor diferente — útil pra controlar margem por item. Use <span class="font-mono">0</span> pra desativar.
                </p>
              </div>
              <div class="relative shrink-0">
                <input
                  v-model.number="editForm.pixDiscountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  class="w-24 border border-slate-200 rounded-lg px-2 py-2 text-sm text-right outline-none focus:border-slate-400 bg-white pr-8"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Aba Descrição completa — full width pra edição confortável.
             Editor ocupa todo o modal (max-w-6xl) e altura de ~60vh. -->
        <div v-show="activeModalTab === 'descricao'" class="p-6 flex-1">
          <div class="mb-3 flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-slate-700 font-medium">Conteúdo rico que aparece na página do produto</p>
              <p class="text-xs text-slate-500 mt-0.5">
                Use a barra de ferramentas pra formatar texto, inserir imagens e vídeos do YouTube.
                Aparece em uma seção dedicada abaixo das informações principais do produto.
              </p>
            </div>
            <a
              v-if="editing && editForm.visibleInStore && editing.slug"
              :href="`/produto/${editing.slug}`"
              target="_blank"
              rel="noopener"
              class="shrink-0 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-full px-3 py-1.5 transition-colors"
            >
              Ver na loja
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M7 17L17 7M7 7h10v10"/></svg>
            </a>
          </div>
          <RichTextEditor
            v-model="editForm.longDescription"
            placeholder="Descreva o produto em detalhes. Você pode adicionar parágrafos, títulos, listas, citações, imagens e vídeos."
            min-height="540px"
          />
        </div>

        <footer class="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white z-10">
          <button @click="closeEdit" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
          <button v-if="perms.can.edit('ecommerce-catalog')" @click="saveEdit" :disabled="saving"
            class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-5 py-2 transition-colors">
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>Salvar</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
