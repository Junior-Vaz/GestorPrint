<template>
  <div class="px-6 py-5 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-5">
      <h1 class="text-2xl font-semibold text-slate-900">Programa de Fidelidade</h1>
      <p class="text-sm text-slate-500 mt-1">
        Pontos por compra, cashback, tiers automáticos, cupom de aniversário e indicação. Aplicado no PDV e na loja online.
      </p>
    </div>

    <!-- Loading / Forbidden -->
    <div v-if="loading" class="text-center text-slate-500 py-20">
      <div class="inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="!plan.hasLoyalty" class="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
      <h3 class="text-base font-semibold text-amber-900">Recurso indisponível no seu plano</h3>
      <p class="text-sm text-amber-800 mt-1">O Programa de Fidelidade está disponível no Basic, Pro e Enterprise.</p>
    </div>

    <!-- Tabs: Configuração + Dashboard -->
    <div v-else>
      <div class="flex items-center gap-1 border-b border-slate-200 mb-5">
        <button v-for="t in [
          { id: 'config' as const,    label: 'Configuração' },
          { id: 'dashboard' as const, label: 'Dashboard' },
        ]" :key="t.id"
          @click="activeTab = t.id"
          :class="['px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === t.id
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-700']">
          {{ t.label }}
        </button>
      </div>

    <div v-show="activeTab === 'config'" class="space-y-5">
      <!-- Master toggle -->
      <section class="bg-white border border-slate-200 rounded-lg p-5">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm font-semibold text-slate-900">Programa ativo</div>
            <div class="text-xs text-slate-500 mt-0.5">
              Quando desligado, novos pedidos não geram pontos/cashback. O saldo existente fica congelado (não zera).
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0">
            <input v-model="config.enabled" type="checkbox" class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
            <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow"></div>
          </label>
        </div>
      </section>

      <!-- Pontos -->
      <section class="bg-white border border-slate-200 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Pontos
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Pontos ganhos por R$ gasto</label>
            <input v-model.number="config.pointsPerReal" type="number" step="0.1" min="0" class="input" />
            <p class="text-[11px] text-slate-400 mt-1">Ex: 1 = cliente ganha 1 ponto a cada R$ 1 gasto.</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Valor de 1 ponto ao resgatar (R$)</label>
            <input v-model.number="config.realsPerPoint" type="number" step="0.001" min="0.001" class="input" />
            <p class="text-[11px] text-slate-400 mt-1">Ex: 0.05 = 100 pontos viram R$ 5 de desconto.</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Validade dos pontos (meses)</label>
            <input v-model.number="config.pointsExpiryMonths" type="number" min="1" max="60" class="input" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Mínimo pra resgatar (pontos)</label>
            <input v-model.number="config.minRedeemPoints" type="number" min="0" class="input" />
          </div>
        </div>
      </section>

      <!-- Cashback -->
      <section class="bg-white border border-slate-200 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Cashback
          <span class="text-[10px] font-normal text-slate-400 ml-1">(opcional — pode coexistir com pontos)</span>
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">% do pedido vira cashback</label>
            <input v-model.number="config.cashbackPercent" type="number" step="0.1" min="0" max="50" class="input" />
            <p class="text-[11px] text-slate-400 mt-1">0% = desativa cashback. Ex: 2% num pedido de R$ 200 = R$ 4 de crédito.</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Validade (meses)</label>
            <input v-model.number="config.cashbackExpiryMonths" type="number" min="1" max="60" class="input" />
          </div>
        </div>
      </section>

      <!-- Tiers -->
      <section class="bg-white border border-slate-200 rounded-lg p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Níveis (tiers)
          </h2>
          <button @click="addTier" class="text-xs text-emerald-700 hover:text-emerald-800 font-medium">+ Adicionar nível</button>
        </div>
        <p class="text-xs text-slate-500 mb-3">
          Calculado automaticamente pelo gasto dos últimos 12 meses. Tier dá desconto direto e multiplica os pontos ganhos.
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th class="py-2 px-2">Nome</th>
                <th class="py-2 px-2">Gasto mín. (R$)</th>
                <th class="py-2 px-2">Desconto (%)</th>
                <th class="py-2 px-2">Mult. pontos</th>
                <th class="py-2 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, idx) in config.tiers" :key="idx" class="border-b border-slate-100">
                <td class="py-2 px-2"><input v-model="t.name" class="input-sm" /></td>
                <td class="py-2 px-2"><input v-model.number="t.minSpend" type="number" min="0" class="input-sm" /></td>
                <td class="py-2 px-2"><input v-model.number="t.discount" type="number" step="0.5" min="0" max="100" class="input-sm" /></td>
                <td class="py-2 px-2"><input v-model.number="t.pointsMultiplier" type="number" step="0.1" min="0" max="10" class="input-sm" /></td>
                <td class="py-2 px-2">
                  <button v-if="config.tiers.length > 1" @click="removeTier(idx)" class="text-slate-400 hover:text-red-500" title="Remover">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-[11px] text-slate-400 mt-2">A ordem importa — deixe o de menor gasto no topo (BRONZE) e o maior embaixo (PLATINUM).</p>
      </section>

      <!-- Aniversário -->
      <section class="bg-white border border-slate-200 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-pink-500 rounded-full"></span>Cupom de aniversário
        </h2>
        <label class="flex items-center gap-3 mb-3">
          <input v-model="config.birthdayCoupon.enabled" type="checkbox" class="w-4 h-4 accent-pink-500" />
          <span class="text-sm text-slate-700">Gerar cupom automaticamente no mês do aniversário do cliente</span>
        </label>
        <div v-if="config.birthdayCoupon.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Desconto (%)</label>
            <input v-model.number="config.birthdayCoupon.discountPercent" type="number" min="0" max="100" class="input" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Validade (dias)</label>
            <input v-model.number="config.birthdayCoupon.validityDays" type="number" min="1" max="365" class="input" />
          </div>
        </div>
      </section>

      <!-- Indicação -->
      <section class="bg-white border border-slate-200 rounded-lg p-5">
        <h2 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>Indicação (referral)
        </h2>
        <p class="text-xs text-slate-500 mb-3">
          Bônus liberado <strong>somente após</strong> o indicado fazer a 1ª compra paga (anti-fraude). Premia ambos: indicador e indicado.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Bônus em pontos</label>
            <input v-model.number="config.referralBonusPoints" type="number" min="0" class="input" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Bônus em cashback (R$)</label>
            <input v-model.number="config.referralBonusCashback" type="number" step="0.01" min="0" class="input" />
          </div>
        </div>
      </section>

      <!-- Save bar -->
      <div class="sticky bottom-0 -mx-6 px-6 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-end gap-3">
        <span v-if="dirty" class="text-xs text-amber-600">Alterações não salvas</span>
        <button @click="loadConfig" :disabled="saving" class="px-3 py-1.5 text-sm border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50">
          Descartar
        </button>
        <button @click="save" :disabled="saving || !dirty"
          class="px-4 py-1.5 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ saving ? 'Salvando…' : 'Salvar configuração' }}
        </button>
      </div>
    </div>

    <!-- ─── Tab Dashboard ─────────────────────────────────────────────────── -->
    <div v-show="activeTab === 'dashboard'" class="space-y-5">
      <div v-if="dashLoading" class="text-center text-slate-500 py-20">
        <div class="inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>
      </div>

      <template v-else-if="dash">
        <!-- KPIs principais -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
            <div class="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">Pontos circulando</div>
            <div class="text-xl font-bold text-emerald-900 mt-1">{{ Number(dash.flow.circulating.points).toLocaleString('pt-BR') }}</div>
            <div class="text-[11px] text-emerald-700 mt-0.5">total no programa</div>
          </div>
          <div class="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div class="text-[11px] font-medium text-blue-700 uppercase tracking-wider">Cashback ativo</div>
            <div class="text-xl font-bold text-blue-900 mt-1">R$ {{ Number(dash.flow.circulating.cashback).toFixed(2).replace('.', ',') }}</div>
            <div class="text-[11px] text-blue-700 mt-0.5">aguardando resgate</div>
          </div>
          <div class="bg-violet-50 border border-violet-100 rounded-lg p-4">
            <div class="text-[11px] font-medium text-violet-700 uppercase tracking-wider">Engajamento 30d</div>
            <div class="text-xl font-bold text-violet-900 mt-1">{{ dash.activity.engagementRate }}%</div>
            <div class="text-[11px] text-violet-700 mt-0.5">{{ dash.activity.activeLast30d }} de {{ dash.activity.totalCustomers }} clientes</div>
          </div>
          <div class="bg-amber-50 border border-amber-100 rounded-lg p-4">
            <div class="text-[11px] font-medium text-amber-700 uppercase tracking-wider">Conversão indicação</div>
            <div class="text-xl font-bold text-amber-900 mt-1">{{ dash.referral.conversionRate }}%</div>
            <div class="text-[11px] text-amber-700 mt-0.5">{{ dash.referral.conversoes }}/{{ dash.referral.cadastros }} compraram</div>
          </div>
        </div>

        <!-- Fluxo de pontos -->
        <section class="bg-white border border-slate-200 rounded-lg p-5">
          <h2 class="text-sm font-semibold text-slate-900 mb-3">Fluxo de pontos (lifetime)</h2>
          <div class="grid grid-cols-3 gap-3 text-center">
            <div>
              <div class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Ganhos</div>
              <div class="text-lg font-bold text-emerald-700 mt-1">+ {{ Number(dash.flow.earned.points).toLocaleString('pt-BR') }}</div>
              <div class="text-[11px] text-slate-400">+ R$ {{ Number(dash.flow.earned.cashback).toFixed(2).replace('.', ',') }}</div>
            </div>
            <div>
              <div class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Resgatados</div>
              <div class="text-lg font-bold text-rose-700 mt-1">- {{ Number(dash.flow.redeemed.points).toLocaleString('pt-BR') }}</div>
              <div class="text-[11px] text-slate-400">- R$ {{ Number(dash.flow.redeemed.cashback).toFixed(2).replace('.', ',') }}</div>
            </div>
            <div>
              <div class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Expirados</div>
              <div class="text-lg font-bold text-slate-500 mt-1">- {{ Number(dash.flow.expired.points).toLocaleString('pt-BR') }}</div>
              <div class="text-[11px] text-slate-400">- R$ {{ Number(dash.flow.expired.cashback).toFixed(2).replace('.', ',') }}</div>
            </div>
          </div>
        </section>

        <!-- Distribuição por tier -->
        <section class="bg-white border border-slate-200 rounded-lg p-5">
          <h2 class="text-sm font-semibold text-slate-900 mb-3">Distribuição por nível</h2>
          <div v-if="!dash.tierDistribution.length" class="text-center text-slate-400 text-xs py-6">
            Nenhum cliente em nível ainda.
          </div>
          <div v-else class="space-y-2">
            <div v-for="t in tierBreakdown" :key="t.tier || 'sem'" class="flex items-center gap-3">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap', tierColor(t.tier)]" style="min-width:80px;justify-content:center">
                {{ t.tier || 'Sem nível' }}
              </span>
              <div class="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div class="h-full transition-all" :style="{ width: t.pct + '%', background: tierBarColor(t.tier) }"></div>
              </div>
              <span class="text-xs text-slate-600 tabular-nums whitespace-nowrap">{{ t.count }} ({{ t.pct }}%)</span>
            </div>
          </div>
        </section>

        <!-- Top 10 clientes -->
        <section class="bg-white border border-slate-200 rounded-lg p-5">
          <h2 class="text-sm font-semibold text-slate-900 mb-3">Top 10 clientes (gasto 12 meses)</h2>
          <div v-if="!dash.topClients.length" class="text-center text-slate-400 text-xs py-6">
            Nenhum cliente com saldo ainda.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th class="py-2 px-2">#</th>
                  <th class="py-2 px-2">Cliente</th>
                  <th class="py-2 px-2">Tier</th>
                  <th class="py-2 px-2 text-right">Pontos</th>
                  <th class="py-2 px-2 text-right">Cashback</th>
                  <th class="py-2 px-2 text-right">Spend 12m</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, idx) in dash.topClients" :key="c.id" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-2 px-2 text-slate-400 tabular-nums">{{ idx + 1 }}</td>
                  <td class="py-2 px-2 text-slate-700 truncate max-w-[220px]">{{ c.name }}</td>
                  <td class="py-2 px-2">
                    <span v-if="c.loyaltyTier" :class="['inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', tierColor(c.loyaltyTier)]">
                      {{ c.loyaltyTier }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <td class="py-2 px-2 text-right text-slate-700 tabular-nums">{{ Number(c.loyaltyPoints).toLocaleString('pt-BR') }}</td>
                  <td class="py-2 px-2 text-right text-slate-700 tabular-nums">R$ {{ Number(c.loyaltyBalance).toFixed(2).replace('.', ',') }}</td>
                  <td class="py-2 px-2 text-right font-semibold text-slate-900 tabular-nums">R$ {{ Number(c.loyaltySpend12m).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <div v-else class="text-center text-slate-400 text-sm py-10">
        Sem dados ainda.
      </div>
    </div>

    </div><!-- /tabs wrapper -->
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch, computed } from 'vue'
import { apiFetch } from '@/utils/api'
import { usePlanStore } from '@/stores/plan'

const plan = usePlanStore()

interface LoyaltyTier { name: string; minSpend: number; discount: number; pointsMultiplier: number }
interface LoyaltyConfig {
  enabled: boolean
  pointsPerReal: number
  realsPerPoint: number
  pointsExpiryMonths: number
  minRedeemPoints: number
  cashbackPercent: number
  cashbackExpiryMonths: number
  tiers: LoyaltyTier[]
  birthdayCoupon: { enabled: boolean; discountPercent: number; validityDays: number }
  referralBonusPoints: number
  referralBonusCashback: number
}

const defaultConfig = (): LoyaltyConfig => ({
  enabled: false,
  pointsPerReal: 1,
  realsPerPoint: 0.05,
  pointsExpiryMonths: 12,
  minRedeemPoints: 100,
  cashbackPercent: 0,
  cashbackExpiryMonths: 6,
  tiers: [
    { name: 'BRONZE',   minSpend: 0,     discount: 0, pointsMultiplier: 1 },
    { name: 'SILVER',   minSpend: 1000,  discount: 2, pointsMultiplier: 1.5 },
    { name: 'GOLD',     minSpend: 5000,  discount: 5, pointsMultiplier: 2 },
    { name: 'PLATINUM', minSpend: 15000, discount: 8, pointsMultiplier: 3 },
  ],
  birthdayCoupon: { enabled: true, discountPercent: 10, validityDays: 30 },
  referralBonusPoints: 200,
  referralBonusCashback: 0,
})

const config = reactive<LoyaltyConfig>(defaultConfig())
const original = ref<string>('')   // snapshot serializado pra detectar dirty
const loading = ref(true)
const saving = ref(false)

const dirty = computed(() => JSON.stringify(config) !== original.value)

// ── Tabs (Configuração + Dashboard) ──────────────────────────────────────
const activeTab = ref<'config' | 'dashboard'>('config')

// ── Dashboard ────────────────────────────────────────────────────────────
// Lazy-load: só carrega quando user clica na tab. Watcher abaixo.
interface DashboardData {
  enabled: boolean
  topClients: Array<{ id: number; name: string; email: string; loyaltyPoints: number; loyaltyBalance: number; loyaltyTier: string | null; loyaltySpend12m: number; pointsValue: number }>
  tierDistribution: Array<{ tier: string | null; count: number }>
  flow: {
    earned: { points: number; cashback: number }
    redeemed: { points: number; cashback: number }
    expired: { points: number; cashback: number }
    circulating: { points: number; cashback: number }
  }
  referral: { cadastros: number; conversoes: number; conversionRate: number }
  activity: { activeLast30d: number; totalCustomers: number; engagementRate: number }
  tiers: Array<{ name: string; minSpend: number; discount: number; pointsMultiplier: number }>
}
const dash = ref<DashboardData | null>(null)
const dashLoading = ref(false)

async function loadDashboard() {
  if (dashLoading.value) return
  dashLoading.value = true
  try {
    const res = await apiFetch('/api/loyalty/dashboard', { silentOn403: true })
    if (res.ok) dash.value = await res.json()
  } finally {
    dashLoading.value = false
  }
}

// Disparado quando user troca pra aba Dashboard pela primeira vez
watch(activeTab, (val) => { if (val === 'dashboard' && !dash.value) loadDashboard() })

// Computed pra distribuição com porcentagem (pra barra visual)
const tierBreakdown = computed(() => {
  if (!dash.value) return []
  const total = dash.value.tierDistribution.reduce((sum, t) => sum + t.count, 0)
  // Ordena pela ordem dos tiers configurados (BRONZE primeiro, etc)
  const tierOrder = (dash.value.tiers || []).map((t) => t.name)
  const sorted = [...dash.value.tierDistribution].sort((a, b) => {
    if (a.tier === null) return 1
    if (b.tier === null) return -1
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  })
  return sorted.map((t) => ({
    ...t,
    pct: total > 0 ? +((t.count / total) * 100).toFixed(1) : 0,
  }))
})

function tierColor(name: string | null | undefined): string {
  switch ((name || '').toUpperCase()) {
    case 'BRONZE':   return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'SILVER':   return 'bg-slate-200 text-slate-800 border-slate-300'
    case 'GOLD':     return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'PLATINUM': return 'bg-violet-100 text-violet-800 border-violet-300'
    default:         return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}
function tierBarColor(name: string | null | undefined): string {
  switch ((name || '').toUpperCase()) {
    case 'BRONZE':   return '#f97316'
    case 'SILVER':   return '#64748b'
    case 'GOLD':     return '#f59e0b'
    case 'PLATINUM': return '#7c3aed'
    default:         return '#94a3b8'
  }
}

async function loadConfig() {
  loading.value = true
  try {
    const res = await apiFetch('/api/loyalty/config', { silentOn403: true })
    if (res.ok) {
      const data = await res.json()
      Object.assign(config, defaultConfig(), data)
      original.value = JSON.stringify(config)
    }
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!dirty.value) return
  saving.value = true
  try {
    const res = await apiFetch('/api/loyalty/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    if (res.ok) {
      original.value = JSON.stringify(config)
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Configuração salva' } }))
    } else {
      const err = await res.json().catch(() => ({}))
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: err.message || 'Erro ao salvar' } }))
    }
  } finally {
    saving.value = false
  }
}

function addTier() {
  const last = config.tiers[config.tiers.length - 1]
  config.tiers.push({
    name: 'NOVO_TIER',
    minSpend: (last?.minSpend ?? 0) + 1000,
    discount: 0,
    pointsMultiplier: 1,
  })
}

function removeTier(idx: number) {
  config.tiers.splice(idx, 1)
}

onMounted(async () => {
  if (!plan.data) await plan.load()
  await loadConfig()
})

// Quando o plano carrega depois e libera o feature, recarrega a config
watch(() => plan.hasLoyalty, (val) => { if (val && loading.value) loadConfig() })
</script>

<style scoped>
@reference "tailwindcss";

.input {
  @apply w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200;
}
.input-sm {
  @apply w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200;
}
</style>
