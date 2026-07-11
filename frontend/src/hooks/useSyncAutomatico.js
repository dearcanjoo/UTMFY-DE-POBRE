import { useEffect, useRef } from 'react'
import { supabase, FUNCTIONS_URL } from '../lib/supabase.js'

const INTERVALO_MINIMO = 3 * 60 * 1000 // não dispara de novo antes de 3 min

// Dispara uma sincronização em segundo plano (Cakto + Meta) ao abrir o app
// e sempre que a aba voltar ao foco. O Realtime cuida de mostrar o resultado.
export function useSyncAutomatico(usuario) {
  const ultimaRef = useRef(0)

  useEffect(() => {
    if (!usuario) return

    async function disparar() {
      const agora = Date.now()
      if (agora - ultimaRef.current < INTERVALO_MINIMO) return
      ultimaRef.current = agora
      try {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess?.session?.access_token
        if (!token) return
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        // fire-and-forget: erros aqui não devem atrapalhar a navegação
        fetch(`${FUNCTIONS_URL}/sync-meta-spend`, { method: 'POST', headers, body: '{}' }).catch(() => {})
        fetch(`${FUNCTIONS_URL}/sync-cakto`, { method: 'POST', headers, body: '{}' }).catch(() => {})
      } catch { /* silencioso */ }
    }

    disparar() // ao abrir o app

    function aoVoltarFoco() {
      if (document.visibilityState === 'visible') disparar()
    }
    document.addEventListener('visibilitychange', aoVoltarFoco)
    return () => document.removeEventListener('visibilitychange', aoVoltarFoco)
  }, [usuario])
}
