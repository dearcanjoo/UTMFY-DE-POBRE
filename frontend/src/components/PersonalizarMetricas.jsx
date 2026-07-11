import { useState } from 'react'
import { CATALOGO, CATEGORIAS, METRICAS_PADRAO, metricaPorId } from '../lib/metricas.js'

const Seta = ({ cima }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={cima ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)
const X = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)
const Mais = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export default function PersonalizarMetricas({ selecionadas, aoSalvar, aoFechar }) {
  const [lista, setLista] = useState(selecionadas)

  function mover(i, delta) {
    const j = i + delta
    if (j < 0 || j >= lista.length) return
    const nova = [...lista]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    setLista(nova)
  }
  function remover(id) { setLista(lista.filter((m) => m !== id)) }
  function adicionar(id) { if (!lista.includes(id)) setLista([...lista, id]) }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecalho">
          <div>
            <div className="modal-titulo">Personalizar painel</div>
            <div className="texto-suave">Escolha as métricas e a ordem em que aparecem no seu dashboard.</div>
          </div>
          <button className="botao-icone" onClick={aoFechar} aria-label="Fechar"><X /></button>
        </div>

        <div className="modal-corpo">
          <div className="modal-secao-titulo">No seu painel ({lista.length})</div>
          {lista.length === 0 && <div className="texto-suave" style={{ marginBottom: 12 }}>Nenhuma métrica selecionada.</div>}
          <div className="lista-ordenavel">
            {lista.map((id, i) => {
              const def = metricaPorId(id)
              if (!def) return null
              return (
                <div className="item-ordenavel" key={id}>
                  <span className="item-ordem">{i + 1}</span>
                  <span className="item-nome">{def.rotulo}</span>
                  <span className="item-acoes">
                    <button className="botao-icone" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"><Seta cima /></button>
                    <button className="botao-icone" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label="Descer"><Seta /></button>
                    <button className="botao-icone remover" onClick={() => remover(id)} aria-label="Remover"><X /></button>
                  </span>
                </div>
              )
            })}
          </div>

          {CATEGORIAS.map((cat) => {
            const disponiveis = CATALOGO.filter((m) => m.categoria === cat.id && !lista.includes(m.id))
            if (disponiveis.length === 0) return null
            return (
              <div key={cat.id}>
                <div className="modal-secao-titulo">{cat.rotulo}</div>
                <div className="chips-metricas">
                  {disponiveis.map((m) => (
                    <button className="chip-metrica" key={m.id} onClick={() => adicionar(m.id)} title={m.descricao}>
                      <Mais /> {m.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="modal-rodape">
          <button className="botao secundario pequeno" onClick={() => setLista(METRICAS_PADRAO)}>Restaurar padrão</button>
          <button className="botao pequeno" onClick={() => { aoSalvar(lista); aoFechar() }}>Salvar painel</button>
        </div>
      </div>
    </div>
  )
}
