import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { moeda } from '../lib/formato.js'

const MEDALHA = { 1: '🥇', 2: '🥈', 3: '🥉' }

// Card de um dos três primeiros no pódio.
function PodioItem({ u, lugar }) {
  const inicial = (u.nome_usuario?.[0] || '?').toUpperCase()
  return (
    <div className={`podio-item lugar-${lugar}${u.eh_voce ? ' eh-voce' : ''}`}>
      <div className="podio-avatar">
        {inicial}
        <span className="podio-medalha">{MEDALHA[lugar]}</span>
      </div>
      <div className="podio-nome">@{u.nome_usuario}</div>
      {u.eh_voce && <span className="rank-tag">você</span>}
      <div className="podio-valor">{moeda(Number(u.total))}</div>
      <div className="podio-base">
        <span className="podio-num">{lugar}º</span>
      </div>
    </div>
  )
}

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

  const porPos = (p) => top.find((u) => u.posicao === p) || null
  const primeiro = porPos(1)
  const segundo = porPos(2)
  const terceiro = porPos(3)
  const resto = top.filter((u) => u.posicao >= 4)
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
        <>
          <div className="rank-podio-card">
            <div className="rank-podio">
              {segundo && <PodioItem u={segundo} lugar={2} />}
              {primeiro && <PodioItem u={primeiro} lugar={1} />}
              {terceiro && <PodioItem u={terceiro} lugar={3} />}
            </div>
          </div>

          {resto.length > 0 && (
            <div className="card secao rank-lista">
              {resto.map((u) => (
                <div key={u.posicao} className={`rank-linha${u.eh_voce ? ' rank-voce' : ''}`}>
                  <div className="rank-pos">{u.posicao}</div>
                  <div className="rank-nome">
                    @{u.nome_usuario}
                    {u.eh_voce && <span className="rank-tag">você</span>}
                  </div>
                  <div className="rank-valor">{moeda(Number(u.total))}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {estado === 'ok' && voce && !voceNoTop && (
        <div className="card secao rank-lista" style={{ marginTop: 12 }}>
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
