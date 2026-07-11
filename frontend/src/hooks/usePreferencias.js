import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { METRICAS_PADRAO, metricaPorId, GRAFICOS_PADRAO, graficoPorId } from '../lib/metricas.js'

const CHAVE_LOCAL = 'macacofy_dashboard_metricas'

const PADRAO = { metricas: METRICAS_PADRAO, graficos: GRAFICOS_PADRAO }

// Aceita o formato antigo (array de métricas) e o novo ({ metricas, graficos })
function normalizar(raw) {
  if (Array.isArray(raw)) {
    const metricas = raw.filter((id) => metricaPorId(id))
    return metricas.length ? { metricas, graficos: GRAFICOS_PADRAO } : null
  }
  if (raw && typeof raw === 'object') {
    const metricas = (Array.isArray(raw.metricas) ? raw.metricas : METRICAS_PADRAO).filter((id) => metricaPorId(id))
    const graficos = (Array.isArray(raw.graficos) ? raw.graficos : GRAFICOS_PADRAO).filter((id) => graficoPorId(id))
    return { metricas, graficos }
  }
  return null
}

function lerLocal() {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL)
    return raw ? normalizar(JSON.parse(raw)) : null
  } catch { return null }
}

// Preferências do dashboard (quais métricas/gráficos e em que ordem).
// localStorage dá resposta instantânea; o banco sincroniza entre dispositivos.
export function usePreferencias(usuario) {
  const [prefs, setPrefs] = useState(() => lerLocal() || PADRAO)

  useEffect(() => {
    if (!usuario) return
    supabase.from('preferencias').select('dashboard_metricas').maybeSingle()
      .then(({ data }) => {
        const norm = normalizar(data?.dashboard_metricas)
        if (norm) {
          setPrefs(norm)
          localStorage.setItem(CHAVE_LOCAL, JSON.stringify(norm))
        }
      })
  }, [usuario])

  const salvar = useCallback(async (novas) => {
    const norm = normalizar(novas) || PADRAO
    setPrefs(norm)
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(norm))
    if (usuario) {
      await supabase.from('preferencias').upsert(
        { usuario_id: usuario.id, dashboard_metricas: norm, atualizado_em: new Date().toISOString() },
        { onConflict: 'usuario_id' },
      )
    }
  }, [usuario])

  return { metricas: prefs.metricas, graficos: prefs.graficos, salvar }
}
