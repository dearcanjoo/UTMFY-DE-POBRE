import { CATALOGO, CATEGORIAS, GRAFICOS } from '../lib/metricas.js'

// Painel lateral do modo de edição (estilo UTMify): todas as métricas
// disponíveis à esquerda, agrupadas por categoria. Adiciona por clique
// ou arrastando o chip para a grade.
export default function PainelEdicao({ metricas, graficos, aoAlternarMetrica, aoAlternarGrafico, aoIniciarArrasto }) {
  return (
    <aside className="painel-edicao">
      <div className="painel-titulo">Métricas disponíveis</div>
      <div className="painel-dica">Clique para adicionar ou remover. Arraste para posicionar.</div>
      {CATEGORIAS.map((cat) => {
        const itens = CATALOGO.filter((m) => m.categoria === cat.id)
        if (!itens.length) return null
        return (
          <div className="painel-secao" key={cat.id}>
            <div className="painel-secao-titulo">{cat.rotulo}</div>
            <div className="painel-chips">
              {itens.map((m) => {
                const ativa = metricas.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`chip-edicao ${ativa ? 'ativa' : ''}`}
                    title={m.descricao}
                    draggable={!ativa}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', m.id)
                      e.dataTransfer.effectAllowed = 'copy'
                      aoIniciarArrasto({ tipo: 'metrica', origem: 'painel', id: m.id })
                    }}
                    onClick={() => aoAlternarMetrica(m.id)}
                  >
                    {m.rotulo}
                    <span className="chip-sinal">{ativa ? '−' : '+'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="painel-secao">
        <div className="painel-secao-titulo">Gráficos</div>
        <div className="painel-chips">
          {GRAFICOS.map((g) => {
            const ativo = graficos.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                className={`chip-edicao ${ativo ? 'ativa' : ''}`}
                title={g.descricao}
                onClick={() => aoAlternarGrafico(g.id)}
              >
                {g.rotulo}
                <span className="chip-sinal">{ativo ? '−' : '+'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
