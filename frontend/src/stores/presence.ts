/**
 * Pinia store de presença em tempo real — quem está online no mesmo tenant.
 *
 * Mantém socket dedicado pro gateway `PresenceGateway` do backend. Pode parecer
 * desperdício ter um socket separado do `notification`, mas é o padrão atual
 * do projeto (cada feature gerencia o seu) e simplifica disconnect/reconnect
 * sem afetar outras features.
 *
 * Uso:
 *   const presence = usePresenceStore()
 *   presence.connect()  // chame uma vez ao logar
 *   presence.users      // ref reativa com lista de OnlineUser
 *   presence.count      // contagem total
 *   presence.disconnect()  // chame ao deslogar
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, type Socket } from 'socket.io-client'

export interface OnlineUser {
  userId:   number
  name:     string
  email:    string
  role:     string
  photoUrl: string | null
  since:    number      // timestamp do primeiro socket
}

export const usePresenceStore = defineStore('presence', () => {
  const socket = ref<Socket | null>(null)
  const users  = ref<OnlineUser[]>([])
  const connected = ref(false)

  const count = computed(() => users.value.length)

  function connect() {
    if (socket.value) return
    const token = localStorage.getItem('gp_token')
    if (!token) return

    socket.value = io({ auth: { token } })

    socket.value.on('connect',    () => { connected.value = true })
    socket.value.on('disconnect', () => { connected.value = false })

    socket.value.on('auth_error', (err: any) => {
      console.warn('[presence] auth_error', err?.reason)
    })

    // Estado completo (envia ao conectar e a cada mudança)
    const applyState = (payload: { count: number; users: OnlineUser[] }) => {
      users.value = Array.isArray(payload?.users) ? payload.users : []
    }
    socket.value.on('presence:state',  applyState)
    socket.value.on('presence:update', applyState)
  }

  function disconnect() {
    if (!socket.value) return
    socket.value.disconnect()
    socket.value = null
    users.value = []
    connected.value = false
  }

  return { users, count, connected, connect, disconnect }
})
