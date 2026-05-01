/// <reference types="vite/client" />

// Tipagem das envs que o painel admin usa em build-time. Vite expõe via
// import.meta.env.VITE_*. Adicione novas vars aqui pra ter autocomplete.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_ERP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
