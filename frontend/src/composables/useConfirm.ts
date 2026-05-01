import { ref } from 'vue'

const visible = ref(false)
const title = ref('')
const message = ref('')
const confirmLabel = ref('Confirmar')
const confirmClass = ref('bg-rose-500 hover:bg-rose-600')
let resolveRef: ((value: boolean) => void) | null = null

export function useConfirm() {
  const confirm = (
    msg: string,
    opts?: { title?: string; confirmLabel?: string; danger?: boolean }
  ): Promise<boolean> => {
    message.value = msg
    title.value = opts?.title ?? 'Confirmar ação'
    confirmLabel.value = opts?.confirmLabel ?? 'Confirmar'
    confirmClass.value = opts?.danger === false
      ? 'bg-indigo-600 hover:bg-indigo-700'
      : 'bg-rose-500 hover:bg-rose-600'
    visible.value = true
    return new Promise((resolve) => {
      resolveRef = resolve
    })
  }

  const accept = () => {
    visible.value = false
    resolveRef?.(true)
    resolveRef = null
  }

  const reject = () => {
    visible.value = false
    resolveRef?.(false)
    resolveRef = null
  }

  return { visible, title, message, confirmLabel, confirmClass, confirm, accept, reject }
}
