<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import { usePermissionsStore } from '../../stores/permissions'
import PaginationControls from '../../components/shared/PaginationControls.vue'

const { showToast } = useToast()
const perms = usePermissionsStore()

interface Coupon {
  id: number
  code: string
  description?: string | null
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
  value: number
  minPurchase?: number | null
  maxUses?: number | null
  usedCount: number
  maxUsesPerCustomer: number
  validFrom?: string | null
  validUntil?: string | null
  firstOrderOnly: boolean
  active: boolean
  createdAt: string
}

const coupons = ref<Coupon[]>([])
const loading = ref(true)
const editing = ref<Partial<Coupon> | null>(null)
const saving = ref(false)

// Paginação server-side. Como cupons são ranqueados por createdAt desc, o admin
// vê primeiro os mais recentes — geralmente o que ele criou nos últimos dias.
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const fetchCoupons = async () => {
  loading.value = true
  try {
    const res = await apiFetch(`/api/ecommerce/admin/coupons?page=${page.value}&pageSize=${pageSize.value}`)
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json)) {
        coupons.value = json
        total.value = json.length
      } else {
        coupons.value = json.data || []
        total.value = json.total || 0
      }
    }
  } finally { loading.value = false }
}

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchCoupons()
}

const newCoupon = () => {
  editing.value = {
    code: '', description: '', type: 'PERCENT', value: 10,
    minPurchase: null, maxUses: null, maxUsesPerCustomer: 1,
    validFrom: null, validUntil: null,
    firstOrderOnly: false, active: true,
  }
}

const editCoupon = (c: Coupon) => {
  editing.value = { ...c,
    validFrom: c.validFrom ? c.validFrom.substring(0, 10) : '',
    validUntil: c.validUntil ? c.validUntil.substring(0, 10) : '',
  }
}

const closeEdit = () => { editing.value = null }

const save = async () => {
  if (!editing.value?.code || !editing.value?.type) {
    showToast('Código e tipo obrigatórios', 'error'); return
  }
  saving.value = true
  try {
    const isNew = !editing.value.id
    const url = isNew ? '/api/ecommerce/admin/coupons' : `/api/ecommerce/admin/coupons/${editing.value.id}`
    const res = await apiFetch(url, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing.value),
    })
    if (res.ok) {
      showToast(isNew ? 'Cupom criado' : 'Cupom atualizado', 'success')
      await fetchCoupons()
      closeEdit()
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || 'Erro ao salvar', 'error')
    }
  } finally { saving.value = false }
}

const toggleActive = async (c: Coupon) => {
  try {
    const res = await apiFetch(`/api/ecommerce/admin/coupons/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    if (res.ok) { c.active = !c.active; showToast(c.active ? 'Cupom ativado' : 'Cupom desativado', 'success') }
  } catch { showToast('Erro ao atualizar', 'error') }
}

const deleteCoupon = async (c: Coupon) => {
  if (!confirm(`Excluir cupom "${c.code}"? Pedidos antigos que usaram esse cupom não são afetados.`)) return
  try {
    const res = await apiFetch(`/api/ecommerce/admin/coupons/${c.id}`, { method: 'DELETE' })
    if (res.ok) { showToast('Cupom excluído', 'success'); await fetchCoupons() }
  } catch { showToast('Erro ao excluir', 'error') }
}

const fmtMoney = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'

const typeLabel = (c: Coupon) => {
  if (c.type === 'PERCENT') return `${c.value}%`
  if (c.type === 'FIXED')   return fmtMoney(c.value)
  return 'Frete grátis'
}

const stats = computed(() => ({
  total:    coupons.value.length,
  active:   coupons.value.filter(c => c.active).length,
  totalUses: coupons.value.reduce((s, c) => s + (c.usedCount || 0), 0),
}))

onMounted(fetchCoupons)
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8 space-y-6">
    <div class="flex justify-between items-start">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Cupons de desconto</h1>
        <p class="text-sm text-slate-500 mt-1">Crie códigos promocionais para suas campanhas</p>
      </div>
      <button v-if="perms.can.create('ecommerce-coupons')" @click="newCoupon" class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-4 py-2 transition-colors">
        + Novo cupom
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Total cadastrados</div>
        <div class="text-2xl font-medium text-slate-900 mt-1">{{ stats.total }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Ativos</div>
        <div class="text-2xl font-medium mt-1" style="color:#1D9E75">{{ stats.active }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Usos totais</div>
        <div class="text-2xl font-medium text-slate-900 mt-1">{{ stats.totalUses }}</div>
      </div>
    </div>

    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>
      <table v-else class="w-full text-left">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50/50">
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Código</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Desconto</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Validade</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Usos</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500 text-center">Ativo</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in coupons" :key="c.id" class="border-b border-slate-100 hover:bg-slate-50/60">
            <td class="px-5 py-3">
              <div class="font-mono font-bold text-sm text-slate-900">{{ c.code }}</div>
              <div v-if="c.description" class="text-[11px] text-slate-500">{{ c.description }}</div>
            </td>
            <td class="px-5 py-3 text-sm">
              <span class="font-medium text-slate-900">{{ typeLabel(c) }}</span>
              <div v-if="c.minPurchase" class="text-[11px] text-slate-400">acima de {{ fmtMoney(c.minPurchase) }}</div>
            </td>
            <td class="px-5 py-3 text-[11px] text-slate-500">
              {{ fmtDate(c.validFrom) }} → {{ fmtDate(c.validUntil) }}
            </td>
            <td class="px-5 py-3 text-sm">
              <strong>{{ c.usedCount }}</strong>
              <span class="text-slate-400">/ {{ c.maxUses || '∞' }}</span>
            </td>
            <td class="px-5 py-3 text-center">
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" :checked="c.active" @change="toggleActive(c)" class="sr-only peer" />
                <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </label>
            </td>
            <td class="px-5 py-3 text-right space-x-2 whitespace-nowrap">
              <button v-if="perms.can.edit('ecommerce-coupons')" @click="editCoupon(c)" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">Editar</button>
              <button v-if="perms.can.delete('ecommerce-coupons')" @click="deleteCoupon(c)" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded-full px-3 py-1.5">Excluir</button>
            </td>
          </tr>
          <tr v-if="!coupons.length && !loading">
            <td colspan="6" class="px-5 py-12 text-center text-sm text-slate-400">
              Nenhum cupom cadastrado. Clique em "Novo cupom" pra criar o primeiro.
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Paginação — componente compartilhado -->
      <div v-if="!loading && total > 0" class="px-5 border-t border-slate-200">
        <PaginationControls
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :limit="pageSize"
          @update:page="(p) => { page = p; fetchCoupons() }"
          @update:limit="(n) => { pageSize = n; page = 1; fetchCoupons() }"
        />
      </div>
    </div>

    <!-- Modal -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="closeEdit"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
        <header class="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 class="text-base font-medium text-slate-900">{{ editing.id ? 'Editar cupom' : 'Novo cupom' }}</h3>
          <button @click="closeEdit" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Código *</label>
              <input v-model="editing.code" type="text" placeholder="BEMVINDO10"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Tipo *</label>
              <select v-model="editing.type"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400">
                <option value="PERCENT">Percentual (%)</option>
                <option value="FIXED">Valor fixo (R$)</option>
                <option value="FREE_SHIPPING">Frete grátis</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Descrição interna (não aparece pro cliente)</label>
            <input v-model="editing.description" type="text" placeholder="Promo de Black Friday"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>

          <div v-if="editing.type !== 'FREE_SHIPPING'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">
                Valor *
                <span class="text-slate-400">{{ editing.type === 'PERCENT' ? '(%)' : '(R$)' }}</span>
              </label>
              <input v-model.number="editing.value" type="number" min="0" :step="editing.type === 'PERCENT' ? '1' : '0.01'"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Pedido mínimo (opcional)</label>
              <input v-model.number="editing.minPurchase" type="number" min="0" step="0.01" placeholder="Ex: 100.00"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Válido a partir de</label>
              <input v-model="editing.validFrom" type="date"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Válido até</label>
              <input v-model="editing.validUntil" type="date"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Limite total de usos (vazio = ilimitado)</label>
              <input v-model.number="editing.maxUses" type="number" min="0" placeholder="Ex: 100"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Usos por cliente</label>
              <input v-model.number="editing.maxUsesPerCustomer" type="number" min="1"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>

          <div class="space-y-3">
            <label class="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
              <div>
                <div class="text-sm font-medium text-slate-900">Apenas primeira compra</div>
                <div class="text-xs text-slate-500">Cupom só vale pra clientes sem pedidos pagos anteriores</div>
              </div>
              <input v-model="editing.firstOrderOnly" type="checkbox" class="sr-only peer" />
              <div class="relative w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
            <label class="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer">
              <div>
                <div class="text-sm font-medium text-slate-900">Cupom ativo</div>
                <div class="text-xs text-slate-500">Quando desativado, clientes não conseguem usar</div>
              </div>
              <input v-model="editing.active" type="checkbox" class="sr-only peer" />
              <div class="relative w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
        </div>

        <footer class="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button @click="closeEdit" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
          <button @click="save" :disabled="saving"
            class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-5 py-2 transition-colors">
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>{{ editing.id ? 'Salvar' : 'Criar cupom' }}</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
