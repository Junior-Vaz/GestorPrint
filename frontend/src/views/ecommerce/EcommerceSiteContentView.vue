<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import { usePermissionsStore } from '../../stores/permissions'

const { showToast } = useToast()
const perms = usePermissionsStore()

interface Slide { tag?: string; line1?: string; line2?: string; desc?: string; img?: string; from?: string; ctaLabel?: string; ctaLink?: string }
interface Testimonial { name?: string; role?: string; text?: string; rating?: number; avatar?: string }
interface FAQ { q?: string; a?: string }
interface AboutStat { label?: string; value?: string; desc?: string; cor?: string }
interface AboutValue { icon?: string; label?: string; desc?: string }
interface AboutTimeline { year?: string; title?: string; desc?: string }
interface AboutTeam { nome?: string; cargo?: string; bio?: string; cor?: string }

interface About {
  title?: string
  subtitle?: string
  lead?: string
  paragraphs?: string[]
  stats?: AboutStat[]
  values?: AboutValue[]
  timeline?: AboutTimeline[]
  team?: AboutTeam[]
}

interface LegalPage {
  title: string
  body: string  // HTML
  updatedAt?: string
}

interface Legal {
  returns: LegalPage
  privacy: LegalPage
  terms:   LegalPage
}

interface SiteContent {
  slides: Slide[]
  testimonials: Testimonial[]
  faqs: FAQ[]
  about: About
  legal: Legal
}

const emptyAbout = (): About => ({
  title: '', subtitle: '', lead: '', paragraphs: [], stats: [], values: [], timeline: [], team: [],
})

const emptyLegal = (): Legal => ({
  returns: { title: '', body: '' },
  privacy: { title: '', body: '' },
  terms:   { title: '', body: '' },
})

const tab = ref<'slides' | 'testimonials' | 'faqs' | 'about' | 'legal'>('slides')
const content = ref<SiteContent>({ slides: [], testimonials: [], faqs: [], about: emptyAbout(), legal: emptyLegal() })
const loading = ref(true)
const saving = ref(false)

const fetchContent = async () => {
  loading.value = true
  try {
    const res = await apiFetch('/api/ecommerce/admin/site')
    if (res.ok) {
      const data = await res.json()
      // about pode ter vindo do schema antigo só com { title, subtitle, text } — normaliza
      const incomingAbout: any = data.about || {}
      const incomingLegal: any = data.legal || {}
      content.value = {
        slides: Array.isArray(data.slides) ? data.slides : [],
        testimonials: Array.isArray(data.testimonials) ? data.testimonials : [],
        faqs: Array.isArray(data.faqs) ? data.faqs : [],
        about: {
          title:      incomingAbout.title || '',
          subtitle:   incomingAbout.subtitle || '',
          lead:       incomingAbout.lead || incomingAbout.text || '',
          paragraphs: Array.isArray(incomingAbout.paragraphs) ? incomingAbout.paragraphs : [],
          stats:      Array.isArray(incomingAbout.stats)      ? incomingAbout.stats      : [],
          values:     Array.isArray(incomingAbout.values)     ? incomingAbout.values     : [],
          timeline:   Array.isArray(incomingAbout.timeline)   ? incomingAbout.timeline   : [],
          team:       Array.isArray(incomingAbout.team)       ? incomingAbout.team       : [],
        },
        legal: {
          returns: {
            title: incomingLegal.returns?.title || '',
            body:  incomingLegal.returns?.body  || '',
          },
          privacy: {
            title: incomingLegal.privacy?.title || '',
            body:  incomingLegal.privacy?.body  || '',
          },
          terms: {
            title: incomingLegal.terms?.title || '',
            body:  incomingLegal.terms?.body  || '',
          },
        },
      }
    }
  } finally { loading.value = false }
}

const save = async () => {
  saving.value = true
  try {
    const res = await apiFetch('/api/ecommerce/admin/site', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content.value),
    })
    if (res.ok) {
      showToast('Conteúdo salvo', 'success')
      await fetchContent()
    } else { showToast('Erro ao salvar', 'error') }
  } finally { saving.value = false }
}

// Slides
const addSlide = () => content.value.slides.push({ tag: '', line1: '', line2: '', desc: '', img: '', from: '' })
const removeSlide = (i: number) => content.value.slides.splice(i, 1)

// Testimonials
const addTestimonial = () => content.value.testimonials.push({ name: '', role: '', text: '', rating: 5 })
const removeTestimonial = (i: number) => content.value.testimonials.splice(i, 1)

// FAQs
const addFaq = () => content.value.faqs.push({ q: '', a: '' })
const removeFaq = (i: number) => content.value.faqs.splice(i, 1)

// About — listas
const addAboutParagraph = () => { content.value.about.paragraphs = [...(content.value.about.paragraphs || []), ''] }
const removeAboutParagraph = (i: number) => content.value.about.paragraphs!.splice(i, 1)
const addStat = () => { content.value.about.stats = [...(content.value.about.stats || []), { label: '', value: '', desc: '', cor: '' }] }
const removeStat = (i: number) => content.value.about.stats!.splice(i, 1)
const addValue = () => { content.value.about.values = [...(content.value.about.values || []), { icon: '', label: '', desc: '' }] }
const removeValue = (i: number) => content.value.about.values!.splice(i, 1)
const addTimeline = () => { content.value.about.timeline = [...(content.value.about.timeline || []), { year: '', title: '', desc: '' }] }
const removeTimeline = (i: number) => content.value.about.timeline!.splice(i, 1)
const addTeam = () => { content.value.about.team = [...(content.value.about.team || []), { nome: '', cargo: '', bio: '', cor: '' }] }
const removeTeam = (i: number) => content.value.about.team!.splice(i, 1)

onMounted(fetchContent)
</script>

<template>
  <div class="max-w-4xl mx-auto px-6 py-8 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Conteúdo do site</h1>
        <p class="text-sm text-slate-500 mt-1">Slides do banner, depoimentos, FAQs e página "Sobre" da loja</p>
      </div>
      <button v-if="perms.can.edit('ecommerce-site')" @click="save" :disabled="saving || loading"
        class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-5 py-2 transition-colors">
        <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
        <span v-else>Salvar tudo</span>
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="border-b border-slate-200 flex items-center gap-1">
        <button v-for="t in [
          { v: 'slides',       l: 'Slides do banner',   c: content.slides.length },
          { v: 'testimonials', l: 'Depoimentos',         c: content.testimonials.length },
          { v: 'faqs',         l: 'FAQs',                c: content.faqs.length },
          { v: 'about',        l: 'Sobre',               c: '' },
          { v: 'legal',        l: 'Páginas legais',      c: '' },
        ]" :key="t.v"
          @click="tab = t.v as any"
          :class="['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === t.v ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700']">
          {{ t.l }}
          <span v-if="t.c !== ''" class="ml-1 text-[10px] text-slate-400">({{ t.c }})</span>
        </button>
      </div>

      <!-- Slides -->
      <section v-if="tab === 'slides'" class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-500">Slides do banner principal da home. Recomendado: 3 a 5 slides com imagens em 1200×600px.</p>
          <button v-if="perms.can.edit('ecommerce-site')" @click="addSlide" class="text-sm text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Slide</button>
        </div>
        <div v-for="(s, i) in content.slides" :key="i" class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <span class="text-xs font-medium text-slate-500">Slide #{{ i + 1 }}</span>
            <button v-if="perms.can.edit('ecommerce-site')" @click="removeSlide(i)" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded-full px-2.5 py-1">Excluir</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">Tag (ex: "Convites")</label>
              <input v-model="s.tag" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">A partir de (ex: "4,50")</label>
              <input v-model="s.from" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Linha 1 do título</label>
              <input v-model="s.line1" type="text" placeholder="Convites" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Linha 2 (HTML, ex: &lt;span class="accent"&gt;de casamento&lt;/span&gt;)</label>
              <input v-model="s.line2" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Descrição</label>
            <textarea v-model="s.desc" rows="2" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">URL da imagem</label>
            <input v-model="s.img" type="text" placeholder="https://..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            <img v-if="s.img" :src="s.img" alt="" class="mt-2 h-24 w-full object-cover rounded border border-slate-200" />
          </div>
        </div>
        <p v-if="!content.slides.length" class="text-center py-12 text-sm text-slate-400">Nenhum slide. Clique em "+ Slide" pra adicionar.</p>
      </section>

      <!-- Testimonials -->
      <section v-else-if="tab === 'testimonials'" class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-500">Depoimentos de clientes que aparecem na home e em landing pages.</p>
          <button v-if="perms.can.edit('ecommerce-site')" @click="addTestimonial" class="text-sm text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Depoimento</button>
        </div>
        <div v-for="(t, i) in content.testimonials" :key="i" class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <span class="text-xs font-medium text-slate-500">Depoimento #{{ i + 1 }}</span>
            <button v-if="perms.can.edit('ecommerce-site')" @click="removeTestimonial(i)" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded-full px-2.5 py-1">Excluir</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">Nome</label>
              <input v-model="t.name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cargo / empresa</label>
              <input v-model="t.role" type="text" placeholder="Designer, Empresa X" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Avaliação (1-5)</label>
              <input v-model.number="t.rating" type="number" min="1" max="5" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Texto</label>
            <textarea v-model="t.text" rows="3" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">URL do avatar (opcional)</label>
            <input v-model="t.avatar" type="text" placeholder="https://..." class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
          </div>
        </div>
        <p v-if="!content.testimonials.length" class="text-center py-12 text-sm text-slate-400">Nenhum depoimento. Clique em "+ Depoimento" pra adicionar.</p>
      </section>

      <!-- FAQs -->
      <section v-else-if="tab === 'faqs'" class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-500">Perguntas frequentes que aparecem no FAQ da loja.</p>
          <button v-if="perms.can.edit('ecommerce-site')" @click="addFaq" class="text-sm text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Pergunta</button>
        </div>
        <div v-for="(f, i) in content.faqs" :key="i" class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex justify-between items-start">
            <span class="text-xs font-medium text-slate-500">Pergunta #{{ i + 1 }}</span>
            <button v-if="perms.can.edit('ecommerce-site')" @click="removeFaq(i)" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded-full px-2.5 py-1">Excluir</button>
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Pergunta</label>
            <input v-model="f.q" type="text" placeholder="Quanto tempo leva pra ficar pronto?"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Resposta</label>
            <textarea v-model="f.a" rows="3" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
          </div>
        </div>
        <p v-if="!content.faqs.length" class="text-center py-12 text-sm text-slate-400">Nenhum FAQ. Clique em "+ Pergunta" pra adicionar.</p>
      </section>

      <!-- About -->
      <section v-else-if="tab === 'about'" class="space-y-6">
        <p class="text-xs text-slate-500">Conteúdo da página "Sobre" da loja. Cada seção aqui aparece se preenchida — esconde se ficar vazia.</p>

        <!-- Cabeçalho -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">Cabeçalho</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">Título da página</label>
              <input v-model="content.about.title" type="text" placeholder="Sobre a Gráfica..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Subtítulo (eyebrow)</label>
              <input v-model="content.about.subtitle" type="text" placeholder="Desde 2008"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
        </div>

        <!-- Texto institucional -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">Texto institucional</h4>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Lead (frase de abertura, aceita HTML)</label>
            <textarea v-model="content.about.lead" rows="3"
              placeholder="A Gráfica nasceu em 2008..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-xs text-slate-500">Parágrafos extras</label>
              <button v-if="perms.can.edit('ecommerce-site')" @click="addAboutParagraph" type="button" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-2.5 py-1">+ Parágrafo</button>
            </div>
            <div v-for="(_, i) in (content.about.paragraphs || [])" :key="i" class="flex gap-2 mb-2">
              <textarea v-model="content.about.paragraphs![i]" rows="3"
                class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
              <button v-if="perms.can.edit('ecommerce-site')" @click="removeAboutParagraph(i)" type="button" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded px-2 self-start">×</button>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-900">Indicadores (4 quadros à direita do texto)</h4>
            <button v-if="perms.can.edit('ecommerce-site')" @click="addStat" type="button" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Indicador</button>
          </div>
          <div v-for="(s, i) in (content.about.stats || [])" :key="i" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end p-3 bg-slate-50 rounded-lg">
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Label</label>
              <input v-model="s.label" type="text" placeholder="Anos de casa" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Valor</label>
              <input v-model="s.value" type="text" placeholder="18" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Descrição</label>
              <input v-model="s.desc" type="text" placeholder="Atendendo desde 2008" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div class="flex gap-1">
              <select v-model="s.cor" class="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs">
                <option value="">Cor (auto)</option>
                <option value="c">Ciano</option>
                <option value="m">Magenta</option>
                <option value="y">Amarelo</option>
                <option value="k">Preto</option>
              </select>
              <button v-if="perms.can.edit('ecommerce-site')" @click="removeStat(i)" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded px-2">×</button>
            </div>
          </div>
        </div>

        <!-- Valores -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-900">Valores ("o que nos guia")</h4>
            <button v-if="perms.can.edit('ecommerce-site')" @click="addValue" type="button" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Valor</button>
          </div>
          <div v-for="(v, i) in (content.about.values || [])" :key="i" class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
            <div class="md:col-span-1">
              <label class="block text-[10px] text-slate-500 mb-1">Ícone (1 char)</label>
              <input v-model="v.icon" type="text" maxlength="2" placeholder="◈" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-center" />
            </div>
            <div class="md:col-span-3">
              <label class="block text-[10px] text-slate-500 mb-1">Label</label>
              <input v-model="v.label" type="text" placeholder="Qualidade" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div class="md:col-span-7">
              <label class="block text-[10px] text-slate-500 mb-1">Descrição</label>
              <input v-model="v.desc" type="text" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <button v-if="perms.can.edit('ecommerce-site')" @click="removeValue(i)" class="md:col-span-1 text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded px-2 py-1.5">×</button>
          </div>
        </div>

        <!-- Timeline -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-900">Linha do tempo</h4>
            <button v-if="perms.can.edit('ecommerce-site')" @click="addTimeline" type="button" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Marco</button>
          </div>
          <div v-for="(t, i) in (content.about.timeline || [])" :key="i" class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
            <div class="md:col-span-2">
              <label class="block text-[10px] text-slate-500 mb-1">Ano</label>
              <input v-model="t.year" type="text" placeholder="2008" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div class="md:col-span-3">
              <label class="block text-[10px] text-slate-500 mb-1">Título</label>
              <input v-model="t.title" type="text" placeholder="A primeira máquina" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <div class="md:col-span-6">
              <label class="block text-[10px] text-slate-500 mb-1">Descrição</label>
              <input v-model="t.desc" type="text" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
            <button v-if="perms.can.edit('ecommerce-site')" @click="removeTimeline(i)" class="md:col-span-1 text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded px-2 py-1.5">×</button>
          </div>
        </div>

        <!-- Equipe -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-slate-900">Equipe</h4>
            <button v-if="perms.can.edit('ecommerce-site')" @click="addTeam" type="button" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">+ Pessoa</button>
          </div>
          <div v-for="(p, i) in (content.about.team || [])" :key="i" class="p-3 bg-slate-50 rounded-lg space-y-2">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div class="md:col-span-4">
                <label class="block text-[10px] text-slate-500 mb-1">Nome</label>
                <input v-model="p.nome" type="text" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
              </div>
              <div class="md:col-span-4">
                <label class="block text-[10px] text-slate-500 mb-1">Cargo</label>
                <input v-model="p.cargo" type="text" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
              </div>
              <div class="md:col-span-3">
                <label class="block text-[10px] text-slate-500 mb-1">Cor do avatar</label>
                <select v-model="p.cor" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs">
                  <option value="">Auto</option>
                  <option value="c">Ciano</option>
                  <option value="m">Magenta</option>
                  <option value="y">Amarelo</option>
                  <option value="k">Preto</option>
                </select>
              </div>
              <button v-if="perms.can.edit('ecommerce-site')" @click="removeTeam(i)" class="md:col-span-1 text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded px-2 self-end py-1.5">×</button>
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Bio</label>
              <input v-model="p.bio" type="text" class="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />
            </div>
          </div>
        </div>
      </section>

      <!-- Legal — Política de troca, Privacidade, Termos. Body é HTML simples
           (parágrafos, listas, links). Renderizado por v-html na SPA — pra evitar
           XSS, não exporta scripts/iframes. -->
      <section v-else-if="tab === 'legal'" class="space-y-5">
        <p class="text-xs text-slate-500">
          Cada página fica em uma URL pública (<span class="font-mono">/politica-de-trocas</span>,
          <span class="font-mono">/privacidade</span>, <span class="font-mono">/termos</span>) e
          é linkada no rodapé da loja. Use HTML simples (h2, h3, p, ul/li, a, strong).
        </p>

        <!-- Política de Troca / Devolução -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">Política de Troca e Devolução</h4>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Título da página</label>
            <input v-model="content.legal.returns.title" type="text"
              placeholder="Política de Troca e Devolução"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Conteúdo (HTML)</label>
            <textarea v-model="content.legal.returns.body" rows="14"
              placeholder="<h2>Quando você pode trocar</h2><p>Aceitamos trocas em até 7 dias após a entrega...</p>"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400 resize-y"></textarea>
          </div>
        </div>

        <!-- Privacidade -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">Política de Privacidade</h4>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Título da página</label>
            <input v-model="content.legal.privacy.title" type="text"
              placeholder="Política de Privacidade"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Conteúdo (HTML)</label>
            <textarea v-model="content.legal.privacy.body" rows="14"
              placeholder="<h2>Dados que coletamos</h2><p>Para processar seu pedido...</p>"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400 resize-y"></textarea>
          </div>
        </div>

        <!-- Termos -->
        <div class="border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 class="text-sm font-semibold text-slate-900">Termos de Uso</h4>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Título da página</label>
            <input v-model="content.legal.terms.title" type="text"
              placeholder="Termos de Uso"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Conteúdo (HTML)</label>
            <textarea v-model="content.legal.terms.body" rows="14"
              placeholder="<h2>Aceitação</h2><p>Ao usar o site...</p>"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400 resize-y"></textarea>
          </div>
        </div>

        <p class="text-[11px] text-slate-400 leading-relaxed">
          Dica: comece pela política de trocas — é a mais procurada por clientes antes de comprar.
          Em todas as páginas, use linguagem direta e concreta (prazos exatos, condições, contato).
        </p>
      </section>
    </template>
  </div>
</template>
