import { useState, useMemo } from 'react'
import { hojeBrasilia, somaDias } from '../lib/formato.js'

export const PRESETS = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: 'ontem', rotulo: 'Ontem' },
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: 'mes', rotulo: 'Mês atual' },
  { id: 'mes_ant', rotulo: 'Mês anterior' },
  { id: 'custom', rotulo: 'Personalizado' },
]

export function usePeriodo() {
  const [preset, setPreset] = useState('hoje')
  const [customInicio, setCustomInicio] = useState(hojeBrasilia())
  const [customFim, setCustomFim] = useState(hojeBrasilia())

  const { inicio, fim } = useMemo(() => {
    const hoje = hojeBrasilia()
    switch (preset) {
      case 'hoje': return { inicio: hoje, fim: hoje }
      case 'ontem': { const o = somaDias(hoje, -1); return { inicio: o, fim: o } }
      case '7d': return { inicio: somaDias(hoje, -6), fim: hoje }
      case '30d': return { inicio: somaDias(hoje, -29), fim: hoje }
      case 'mes': return { inicio: hoje.slice(0, 8) + '01', fim: hoje }
      case 'mes_ant': {
        const primeiroDia = hoje.slice(0, 8) + '01'
        const fimAnt = somaDias(primeiroDia, -1)
        return { inicio: fimAnt.slice(0, 8) + '01', fim: fimAnt }
      }
      case 'custom': return { inicio: customInicio, fim: customFim }
      default: return { inicio: hoje, fim: hoje }
    }
  }, [preset, customInicio, customFim])

  return { preset, setPreset, inicio, fim, customInicio, setCustomInicio, customFim, setCustomFim }
}
