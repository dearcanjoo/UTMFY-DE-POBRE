import { CATALOGO, CATEGORIAS, GRAFICOS } from '../lib/metricas.js'

// Painel lateral do modo de edição (estilo UTMify): todas as métricas e
// gráficos disponíveis à esquerda. Adiciona por clique ou arrastando o
// chip direto para a posição desejada na grade.
export default function PainelEdicao({ itens, aoAlternarItem, aoIniciarArrasto }) {
  const chip = (item) => {
    const ativo = itens.includes(item.id)
    return (
      <button
        key={item.id}
        type="button"
        className={`chip-edicao ${ativo ? 'ativa' : ''}`}
        title={item.descricao}
        draggable={!ativo}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', item.id)
          e.dataTransfer.effectAllowed = 'copy'
          aoIniciarArrasto({ origem: 'painel', id: item.id })
        }}
        onClick={() => aoAlternarItem(item.id)}
      >
        {item.rotulo}
        <span className="chip-sinal">{ativo ? '−' : '+'}</span>
      </button>
    )
  }

  return (
    <aside className="painel-edicao">
      <div className="painel-titulo">Métricas disponíveis</div>
      <div className="painel-dica">Clique para adicionar ou remover. Arraste para posicionar.</div>
      {CATEGORIAS.map((cat) => {
        const doGrupo = CATALOGO.filter((m) => m.categoria === cat.id)
        if (!doGrupo.length) return null
        return (
          <div className="painel-secao" key={cat.id}>
            <div className="painel-secao-titulo">{cat.rotulo}</div>
            <div className="painel-chips">{doGrupo.map(chip)}</div>
          </div>
        )
      })}
      <div className="painel-secao">
        <div className="painel-secao-titulo">Gráficos</div>
        <div className="painel-chips">{GRAFICOS.map(chip)}</div>
      </div>
    </aside>
  )
}
