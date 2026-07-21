import { useState } from 'react'
import { hojeBrasilia } from '../lib/formato.js'

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const chave = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Calendário único de intervalo: primeiro clique marca o início,
// segundo clique marca o fim (invertendo se necessário).
export default function MiniCalendario({ inicio, fim, onChange }) {
  const hoje = hojeBrasilia()
  const [ano, setAno] = useState(() => Number((inicio || hoje).slice(0, 4)))
  const [mes, setMes] = useState(() => Number((inicio || hoje).slice(5, 7)) - 1)
  const [escolhendoFim, setEscolhendoFim] = useState(false)

  const mudarMes = (delta) => {
    const d = new Date(Date.UTC(ano, mes + delta, 1))
    setAno(d.getUTCFullYear())
    setMes(d.getUTCMonth())
  }

  const clicar = (dia) => {
    const data = chave(ano, mes, dia)
    if (!escolhendoFim) {
      onChange(data, data) // primeiro clique: início (e fim provisório)
      setEscolhendoFim(true)
    } else {
      if (data < inicio) onChange(data, inicio) // clicou antes: inverte
      else onChange(inicio, data)
      setEscolhendoFim(false)
    }
  }

  const primeiroDiaSemana = new Date(Date.UTC(ano, mes, 1)).getUTCDay()
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const celulas = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ]

  return (
    <div className="mini-calendario">
      <div className="mc-cabecalho">
        <button type="button" className="mc-nav" onClick={() => mudarMes(-1)}>‹</button>
        <span className="mc-mes">{MESES[mes]} {ano}</span>
        <button type="button" className="mc-nav" onClick={() => mudarMes(1)}>›</button>
      </div>
      <div className="mc-grade">
        {DIAS_SEMANA.map((d, i) => <span key={`s${i}`} className="mc-dia-semana">{d}</span>)}
        {celulas.map((dia, i) => {
          if (dia == null) return <span key={`v${i}`} />
          const data = chave(ano, mes, dia)
          const extremo = data === inicio || data === fim
          const dentro = inicio && fim && data > inicio && data < fim
          const futuro = data > hoje
          return (
            <button
              key={data}
              type="button"
              className={`mc-dia ${extremo ? 'extremo' : ''} ${dentro ? 'dentro' : ''} ${data === hoje ? 'hoje' : ''}`}
              disabled={futuro}
              onClick={() => clicar(dia)}
            >
              {dia}
            </button>
          )
        })}
      </div>
      <div className="mc-dica texto-suave">
        {escolhendoFim ? 'Agora clique no dia final' : 'Clique no dia inicial'}
      </div>
    </div>
  )
}
