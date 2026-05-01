<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const uuid = computed(() => String(route.params.uuid || ''))

const loading = ref(true)
const error = ref('')
const data = ref<any>(null)
const action = ref<'idle' | 'approving' | 'rejecting' | 'approved' | 'rejected'>('idle')
const showRejectModal = ref(false)
const rejectReason = ref('')
const showFinalApproveConfirm = ref(false)

// Upload de arte
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadError = ref('')

async function uploadArt(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadError.value = ''
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/files/public-estimate/${uuid.value}`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.message || 'Falha no upload')
    }
    await fetchEstimate()
  } catch (e: any) {
    uploadError.value = e.message || 'Erro ao enviar arquivo.'
  } finally {
    uploading.value = false
    if (input) input.value = ''
  }
}

const isImage = (mt: string) => /^image\//.test(mt || '')
const fileSize = (s: number) => s < 1024 ? `${s} B` : s < 1048576 ? `${(s/1024).toFixed(1)} KB` : `${(s/1048576).toFixed(1)} MB`

async function fetchEstimate() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/estimates/public/${uuid.value}`)
    const json = await res.json()
    if (json.error) {
      error.value = json.error
    } else {
      data.value = json
    }
  } catch (e: any) {
    error.value = 'Não foi possível carregar o orçamento. Verifique sua conexão.'
  } finally {
    loading.value = false
  }
}

async function approve() {
  showFinalApproveConfirm.value = false
  action.value = 'approving'
  try {
    const res = await fetch(`/api/estimates/public/${uuid.value}/approve`, { method: 'POST' })
    const json = await res.json()
    if (res.ok && (json.ok || json.alreadyApproved)) {
      action.value = 'approved'
      await fetchEstimate()
    } else {
      action.value = 'idle'
      alert(json.message || json.error || 'Não foi possível aprovar.')
    }
  } catch {
    action.value = 'idle'
    alert('Erro ao aprovar. Tente novamente.')
  }
}

async function reject() {
  action.value = 'rejecting'
  try {
    const res = await fetch(`/api/estimates/public/${uuid.value}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason.value }),
    })
    const json = await res.json()
    if (res.ok && (json.ok || json.alreadyHandled)) {
      action.value = 'rejected'
      showRejectModal.value = false
      await fetchEstimate()
    } else {
      action.value = 'idle'
    }
  } catch {
    action.value = 'idle'
  }
}

const isFinal = computed(() => ['APPROVED', 'REJECTED', 'EXPIRED'].includes(data.value?.status))

const typeIcon = (t: string) => ({ service: '🧾', plotter: '📐', cutting: '✂️', embroidery: '👕' }[t] || '📦')
const typeLabel = (t: string) => ({ service: 'Serviço', plotter: 'Plotter', cutting: 'Recorte', embroidery: 'Estamparia' }[t] || t)

const validityText = computed(() => {
  if (!data.value?.validUntil) return null
  const v = new Date(data.value.validUntil)
  const now = new Date()
  const diffMs = v.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)
  if (diffDays < 0) return { text: `Expirou em ${v.toLocaleDateString('pt-BR')}`, color: '#A32D2D' }
  if (diffDays === 0) return { text: 'Expira hoje', color: '#BA7517' }
  if (diffDays === 1) return { text: 'Expira amanhã', color: '#BA7517' }
  if (diffDays <= 3) return { text: `Expira em ${diffDays} dias`, color: '#BA7517' }
  return { text: `Válido até ${v.toLocaleDateString('pt-BR')}`, color: '#475569' }
})

const formatCurrency = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const downloadPdf = () => {
  window.open(`/api/estimates/public/${uuid.value}/pdf`, '_blank')
}

onMounted(fetchEstimate)
</script>

<template>
  <div class="min-h-screen w-full" style="background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%);">
    <!-- Loading state -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="w-8 h-8 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center px-4">
      <div class="max-w-sm text-center">
        <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style="background:#FCEBEB">
          <svg class="w-8 h-8" fill="none" stroke="#A32D2D" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>
        </div>
        <h1 class="text-lg font-medium text-slate-900">Não foi possível abrir</h1>
        <p class="text-sm text-slate-500 mt-2">{{ error }}</p>
      </div>
    </div>

    <!-- Conteúdo -->
    <div v-else-if="data" class="max-w-2xl mx-auto px-4 py-8 md:py-12">

      <!-- Cabeçalho da empresa -->
      <header class="flex items-center gap-3 mb-8">
        <img v-if="data.company.logoUrl" :src="data.company.logoUrl" alt="" class="w-12 h-12 rounded-lg object-cover" />
        <div v-else class="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-white font-medium">
          {{ data.company.name?.[0] || 'G' }}
        </div>
        <div>
          <div class="text-base font-medium text-slate-900">{{ data.company.name }}</div>
          <div class="text-xs text-slate-500">{{ data.company.phone || data.company.email || 'Orçamento online' }}</div>
        </div>
      </header>

      <!-- Card principal do orçamento -->
      <div class="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
        <!-- Banner do total -->
        <div class="px-6 py-8 text-center" style="background: linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%);">
          <div class="text-xs text-slate-500 uppercase tracking-wider">Orçamento #{{ String(data.id).padStart(4, '0') }}</div>
          <div class="mt-2 text-sm text-slate-600">para <strong class="text-slate-900">{{ data.customer?.name }}</strong></div>
          <div class="mt-5 text-4xl md:text-5xl font-medium" style="color:#1D9E75">
            {{ formatCurrency(data.totalPrice) }}
          </div>

          <!-- Status pill -->
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <span v-if="data.status === 'APPROVED'" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style="background:#E1F5EE; color:#0F6E56">
              <span class="w-1.5 h-1.5 rounded-full" style="background:#1D9E75"></span>
              Aprovado
            </span>
            <span v-else-if="data.status === 'REJECTED'" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style="background:#FCEBEB; color:#A32D2D">
              <span class="w-1.5 h-1.5 rounded-full" style="background:#A32D2D"></span>
              Recusado
            </span>
            <span v-else-if="data.status === 'EXPIRED'" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Expirado
            </span>
            <span v-else class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style="background:#FAEEDA; color:#854F0B">
              <span class="w-1.5 h-1.5 rounded-full" style="background:#BA7517"></span>
              Aguardando aprovação
            </span>

            <span v-if="validityText && !isFinal" class="text-xs" :style="{ color: validityText.color }">
              · {{ validityText.text }}
            </span>
          </div>
        </div>

        <!-- Detalhes do produto -->
        <div class="p-6 border-t border-slate-100 space-y-4">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ typeIcon(data.estimateType) }}</span>
            <div class="flex-1">
              <div class="text-xs text-slate-500">{{ typeLabel(data.estimateType) }}</div>
              <div class="text-base font-medium text-slate-900">{{ data.details?.productName || data.details?.produto || 'Serviço' }}</div>
            </div>
          </div>

          <dl class="grid grid-cols-2 gap-3 pt-2">
            <div v-if="data.details?.quantity || data.details?.quantidade">
              <dt class="text-xs text-slate-500">Quantidade</dt>
              <dd class="text-sm text-slate-900 mt-0.5">{{ data.details?.quantity || data.details?.quantidade }} unidades</dd>
            </div>
            <div v-if="data.details?.width && data.details?.height">
              <dt class="text-xs text-slate-500">Dimensões</dt>
              <dd class="text-sm text-slate-900 mt-0.5">{{ data.details.width }} × {{ data.details.height }} cm</dd>
            </div>
            <div v-if="data.details?.colors">
              <dt class="text-xs text-slate-500">Cores</dt>
              <dd class="text-sm text-slate-900 mt-0.5">{{ data.details.colors }}</dd>
            </div>
            <div v-if="data.details?.paperName || data.details?.materialName">
              <dt class="text-xs text-slate-500">Material</dt>
              <dd class="text-sm text-slate-900 mt-0.5">{{ data.details.paperName || data.details.materialName }}</dd>
            </div>
          </dl>

          <div v-if="data.details?.discountAmount > 0" class="pt-3 border-t border-slate-100 text-xs text-slate-500">
            Desconto aplicado: <span class="font-medium" style="color:#1D9E75">{{ formatCurrency(data.details.discountAmount) }}</span>
          </div>
        </div>

        <!-- Anexos / Arte -->
        <div class="px-6 py-5 border-t border-slate-100">
          <div class="flex items-center justify-between mb-3 gap-3">
            <div>
              <div class="text-sm font-medium text-slate-900">Arte e arquivos</div>
              <div class="text-xs text-slate-500 mt-0.5">
                {{ data.attachments?.length ? `${data.attachments.length} arquivo(s) anexado(s)` : 'Envie sua arte ou referência' }}
              </div>
            </div>
            <button v-if="!isFinal" @click="fileInput?.click()" :disabled="uploading"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-full px-3 py-1.5 transition-colors shrink-0">
              <svg v-if="uploading" class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4v16m8-8H4"/></svg>
              {{ uploading ? 'Enviando...' : 'Adicionar arquivo' }}
            </button>
            <input ref="fileInput" type="file" class="hidden" @change="uploadArt" accept="image/*,.pdf,.ai,.cdr,.psd,.eps" />
          </div>

          <div v-if="uploadError" class="text-xs mb-2 px-2 py-1.5 rounded" style="background:#FCEBEB; color:#A32D2D">{{ uploadError }}</div>

          <div v-if="data.attachments?.length" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <a v-for="att in data.attachments" :key="att.id"
               :href="`/api/files/${att.filename}`" target="_blank" rel="noopener"
               class="border border-slate-200 hover:border-slate-300 rounded-lg p-2 flex flex-col items-center text-center gap-1 transition-colors">
              <img v-if="isImage(att.mimetype)" :src="`/api/files/${att.filename}`" alt=""
                   class="w-full h-20 object-cover rounded bg-slate-50" />
              <div v-else class="w-full h-20 rounded bg-slate-50 flex items-center justify-center">
                <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <div class="text-[11px] text-slate-700 truncate w-full">{{ att.originalName }}</div>
              <div class="text-[10px] text-slate-400">{{ fileSize(att.size) }}</div>
            </a>
          </div>
          <div v-else-if="!isFinal" class="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
            Nenhum arquivo enviado ainda
          </div>
        </div>

        <!-- Aviso de motivo se rejeitado -->
        <div v-if="data.status === 'REJECTED' && data.rejectedReason" class="px-6 py-4 border-t border-slate-100" style="background:#FCEBEB">
          <div class="text-xs font-medium" style="color:#A32D2D">Motivo da recusa</div>
          <div class="text-sm text-slate-700 mt-1">{{ data.rejectedReason }}</div>
        </div>
      </div>

      <!-- ═══ Ações ═══ -->
      <div v-if="!isFinal" class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          @click="showRejectModal = true"
          :disabled="action !== 'idle'"
          class="inline-flex items-center justify-center gap-2 disabled:opacity-50 text-sm font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl py-3 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
          Recusar
        </button>
        <button
          @click="showFinalApproveConfirm = true"
          :disabled="action !== 'idle'"
          class="inline-flex items-center justify-center gap-2 disabled:opacity-50 text-white text-sm font-medium rounded-xl py-3 transition-colors shadow-sm"
          style="background:#1D9E75"
          onmouseover="this.style.background='#0F6E56'"
          onmouseout="this.style.background='#1D9E75'"
        >
          <svg v-if="action === 'approving'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 13l4 4L19 7"/></svg>
          {{ action === 'approving' ? 'Aprovando...' : 'Aprovar e fechar pedido' }}
        </button>
      </div>

      <!-- Mensagem após ação -->
      <div v-else-if="data.status === 'APPROVED'" class="mt-6 border rounded-xl p-5 text-center" style="background:#E1F5EE; border-color:#A8E0C8">
        <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3" style="background:#1D9E75">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <div class="text-base font-medium" style="color:#0F6E56">Orçamento aprovado!</div>
        <p class="text-sm mt-1" style="color:#0F6E56">A {{ data.company.name }} já foi notificada e iniciará a produção. Em breve entrarão em contato.</p>
      </div>

      <div v-else-if="data.status === 'REJECTED'" class="mt-6 border rounded-xl p-5 text-center" style="background:#FCEBEB; border-color:#F5C0C0">
        <div class="text-base font-medium" style="color:#A32D2D">Orçamento recusado</div>
        <p class="text-sm mt-1 text-slate-600">Se mudar de ideia, entre em contato com a {{ data.company.name }}.</p>
      </div>

      <div v-else-if="data.status === 'EXPIRED'" class="mt-6 border border-slate-200 rounded-xl p-5 text-center bg-slate-50">
        <div class="text-base font-medium text-slate-700">Orçamento expirado</div>
        <p class="text-sm text-slate-500 mt-1">Solicite um novo orçamento para garantir os preços atuais.</p>
      </div>

      <!-- Footer ações secundárias -->
      <div class="mt-6 flex items-center justify-center gap-4 text-xs">
        <button @click="downloadPdf" class="text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Baixar PDF
        </button>
        <span class="text-slate-300">·</span>
        <a v-if="data.company.phone" :href="`https://wa.me/55${data.company.phone.replace(/\D/g, '')}`" target="_blank" rel="noopener" class="text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          Falar no WhatsApp
        </a>
      </div>

      <p class="text-center text-[11px] text-slate-400 mt-10">
        Orçamento gerado pela {{ data.company.name }} via GestorPrint
      </p>
    </div>

    <!-- ═══ Modal: Confirmar aprovação ═══ -->
    <div v-if="showFinalApproveConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="showFinalApproveConfirm = false"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-sm p-6 z-10 text-center">
        <div class="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4" style="background:#E1F5EE">
          <svg class="w-7 h-7" fill="none" stroke="#1D9E75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h3 class="text-base font-medium text-slate-900">Confirmar aprovação?</h3>
        <p class="text-sm text-slate-500 mt-2">
          Ao aprovar, a {{ data.company.name }} iniciará a produção do seu pedido no valor de
          <strong>{{ formatCurrency(data.totalPrice) }}</strong>.
        </p>
        <div class="mt-5 flex flex-col gap-2">
          <button @click="approve"
            class="w-full inline-flex items-center justify-center gap-2 text-white text-sm font-medium rounded-xl py-3 transition-colors"
            style="background:#1D9E75"
            onmouseover="this.style.background='#0F6E56'" onmouseout="this.style.background='#1D9E75'">
            Confirmar aprovação
          </button>
          <button @click="showFinalApproveConfirm = false"
            class="text-sm text-slate-600 hover:text-slate-900 py-2">Cancelar</button>
        </div>
      </div>
    </div>

    <!-- ═══ Modal: Rejeitar com motivo ═══ -->
    <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="showRejectModal = false"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-sm p-6 z-10">
        <h3 class="text-base font-medium text-slate-900">Recusar orçamento</h3>
        <p class="text-sm text-slate-500 mt-1">Conta pra gente o motivo (opcional). Ajuda a oferecer condições melhores na próxima.</p>
        <textarea v-model="rejectReason" rows="3" placeholder="Ex: prazo apertado, achei caro, mudei de ideia..."
          class="w-full mt-4 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors resize-none"></textarea>
        <div class="mt-4 flex flex-col gap-2">
          <button @click="reject" :disabled="action === 'rejecting'"
            class="w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 text-white text-sm font-medium rounded-xl py-3 transition-colors"
            style="background:#A32D2D"
            onmouseover="this.style.background='#7E1F1F'" onmouseout="this.style.background='#A32D2D'">
            <span v-if="action === 'rejecting'" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>Confirmar recusa</span>
          </button>
          <button @click="showRejectModal = false" class="text-sm text-slate-600 hover:text-slate-900 py-2">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>
