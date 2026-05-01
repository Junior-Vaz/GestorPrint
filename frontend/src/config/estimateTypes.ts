// Central config for all estimate types.
// To add a new type: add an entry here — no other file needs changing.

export interface EstimateTypeMethod {
  value: string
  label: string
}

export interface EstimateTypeConfig {
  type: string
  label: string
  planFeature: string | null   // null = always available; string = plan store key
  accentColor: string          // Tailwind color name (indigo, purple, orange, pink…)
  svgPath: string              // SVG path d= for the icon
  methods: EstimateTypeMethod[] // Calculation sub-methods (empty = no sub-method selector)
}

export const ESTIMATE_TYPES: EstimateTypeConfig[] = [
  {
    type: 'service',
    label: 'Serviço / Insumo',
    planFeature: null,
    accentColor: 'indigo',
    svgPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    methods: [],
  },
  {
    type: 'plotter',
    label: 'Impressão Plotter',
    planFeature: 'hasPlotterEstimate',
    accentColor: 'purple',
    svgPath: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
    methods: [],
  },
  {
    type: 'cutting',
    label: 'Recorte',
    planFeature: 'hasCuttingEstimate',
    accentColor: 'orange',
    svgPath: 'M12 12L20 4M12 12l-4.5 4.5M12 12L7.5 7.5M8.12 8.12L4 4m4.12 4.12A3 3 0 106 18a3 3 0 002.12-5.88zM15.88 15.88A3 3 0 1018 18a3 3 0 00-2.12-2.12z',
    methods: [
      { value: 'area',             label: 'Área (m²)' },
      { value: 'per_piece',        label: 'Por Peça' },
      { value: 'area_complexity',  label: 'Área + Complexidade' },
    ],
  },
  {
    type: 'embroidery',
    label: 'Estamparia',
    planFeature: 'hasEmbroideryEstimate',
    accentColor: 'pink',
    svgPath: 'M7 21h10M12 21V3m0 0l4 4m-4-4L8 7',
    methods: [
      { value: 'per_piece',           label: 'Por Peça' },
      { value: 'base_plus_colors',    label: 'Base + Cores' },
      { value: 'setup_plus_per_piece',label: 'Setup + Por Peça' },
    ],
  },
]

export const ESTIMATE_TYPE_MAP = Object.fromEntries(
  ESTIMATE_TYPES.map(t => [t.type, t])
) as Record<string, EstimateTypeConfig>
