import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { moeda } from '../lib/formato.js'

const MEDALHA = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Ranking() {
  const [estado, setEstado] = useState('carregando') // carregando | ok | erro
  const [top, setTop] = useState([])
  const [voce, setVoce] = useState(null)

  useEffect(() => {
    let vivo = true
    supabase.rpc('ranking_vendas').then(({ data, error }) => {
      if (!vivo) return
      if (error) { setEstado('erro'); return }
      setTop(data?.top ?? [])
      setVoce(data?.voce ?? null)
      setEstado('ok')
    })
    return () => { vivo = false }
  }, [])

  // Se o usuário existe no ranking mas está fora do top 10, mostramos a linha dele à parte.
  const voceNoTop = voce && voce.posicao <= 10

  return (
    <div>
      <h1 className="titulo-pagina">Ranking</h1>
      <p className="texto-suave" style={{ marginBottom: 16 }}>
        TOP 10 por total vendido (comissão) desde a criação da conta no MacacoFy. Atualiza conforme suas vendas são rastreadas.
      </p>

      {estado === 'carregando' && (
        <div className="card secao"><p className="texto-suave">Carregando ranking…</p></div>
      )}

      {estado === 'erro' && (
        <div className="card secao"><p className="texto-suave">Não consegui carregar o ranking agora. Tente novamente em instantes.</p></div>
      )}

      {estado === 'ok' && top.length === 0 && (
        <div className="card secao">
          <p className="texto-suave">Ainda não há vendas rastreadas para montar o ranking. Assim que as vendas começarem a entrar, o TOP 10 aparece aqui.</p>
        </div>
      )}

      {estado === 'ok' && top.length > 0 && (
        <div className="card secao rank-lista">
          {top.map((u) => (
            <div key={u.posicao} className={`rank-linha${u.eh_voce ? ' rank-voce' : ''}`}>
              <div className={`rank-pos${u.posicao <= 3 ? ' rank-pos-top' : ''}`}>
                {MEDALHA[u.posicao] || u.posicao}
              </div>
              <div className="rank-nome">
                @{u.nome_usuario}
                {u.eh_voce && <span className="rank-tag">você</span>}
              </div>
              <div className="rank-valor">{moeda(Number(u.total))}</div>
            </div>
          ))}
        </div>
      )}

      {estado === 'ok' && voce && !voceNoTop && (
        <div className="card secao rank-lista" style={{ marginTop: -4 }}>
          <div className="rank-sua-posicao">Sua posição</div>
          <div className="rank-linha rank-voce">
            <div className="rank-pos">{voce.posicao}</div>
            <div className="rank-nome">@{voce.nome_usuario}<span className="rank-tag">você</span></div>
            <div className="rank-valor">{moeda(Number(voce.total))}</div>
          </div>
        </div>
      )}
    </div>
  )
}
