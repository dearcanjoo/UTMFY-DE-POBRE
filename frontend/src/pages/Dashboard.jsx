import { useState, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { usePeriodo } from '../hooks/usePeriodo.js'
import { useMetricas } from '../hooks/useMetricas.js'
import { usePreferencias } from '../hooks/usePreferencias.js'
import { metricaPorId, graficoPorId, formatarValor, corDaMetrica, ITENS_PADRAO } from '../lib/metricas.js'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import CardMetrica from '../components/CardMetrica.jsx'
import GraficoLucro from '../components/GraficoLucro.jsx'
import GraficoPagamentos from '../components/GraficoPagamentos.jsx'
import GraficoHorario from '../components/GraficoHorario.jsx'
import FunilConversao from '../components/FunilConversao.jsx'
import PainelEdicao from '../components/PainelEdicao.jsx'
import { moeda } from '../lib/formato.js'

const IconeLapis = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
)

const GRAFICOS_LARGOS = new Set(['evolucaoLucro', 'funil'])

export default function Dashboard() {
  const { usuario } = useAuth()
  const periodo = usePeriodo()
  const { dados, carregando, erro } = useMetricas(periodo.inicio, periodo.fim)
  const { itens: itensSalvos, salvar } = usePreferencias(usuario)

  // ===== Modo de edição (estilo UTMify) =====
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState([])
  const arrasto = useRef(null) // { origem: 'painel'|'grade', id }
  const fantasmaRef = useRef(null) // { id, pos } — lido no drop (evita estado defasado)
  const [fantasma, setFantasma] = useState(null) // idem, só para renderizar a pré-visualização

  const itens = editando ? rascunho : itensSalvos

  const iniciarEdicao = () => {
    setRascunho(itensSalvos)
    setEditando(true)
  }
  const limparArrasto = () => { arrasto.current = null; fantasmaRef.current = null; setFantasma(null) }
  const cancelar = () => { setEditando(false); limparArrasto() }
  const redefinir = () => setRascunho(ITENS_PADRAO)
  const salvarEdicao = async () => {
    await salvar({ itens: rascunho })
    setEditando(false)
    limparArrasto()
  }

  // Clique no chip: remove se já está; senão adiciona (métrica entra antes
  // do primeiro gráfico, gráfico entra no fim).
  const alternarItem = useCallback((id) => {
    setRascunho((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id)
      if (metricaPorId(id)) {
        const primeiroGrafico = atual.findIndex((x) => graficoPorId(x))
        if (primeiroGrafico >= 0) return [...atual.slice(0, primeiroGrafico), id, ...atual.slice(primeiroGrafico)]
      }
      return [...atual, id]
    })
  }, [])

  // ===== Arrastar e soltar com pré-visualização (fantasma) =====
  const aoIniciarArrasto = useCallback((info) => { arrasto.current = info }, [])

  // posSem = posição do item sob o cursor na lista SEM o item arrastado
  const sobreItem = (e, posSem, ehGrafico) => {
    const info = arrasto.current
    if (!info) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const depois = ehGrafico
      ? e.clientY - rect.top > rect.height / 2
      : e.clientX - rect.left > rect.width / 2
    const pos = posSem + (depois ? 1 : 0)
    if (fantasmaRef.current?.pos !== pos || fantasmaRef.current?.id !== info.id) {
      fantasmaRef.current = { id: info.id, pos }
      setFantasma({ id: info.id, pos })
    }
  }

  const soltarNaGrade = (e) => {
    e.preventDefault()
    const info = arrasto.current
    const alvo = fantasmaRef.current
    limparArrasto()
    if (!info) return
    setRascunho((atual) => {
      const lista = atual.filter((x) => x !== info.id)
      const pos = alvo ? Math.min(alvo.pos, lista.length) : lista.length
      lista.splice(pos, 0, info.id)
      return lista
    })
  }

  // Lista exibida: sem o item arrastado, com o fantasma inserido na posição
  // alvo — a grade real se reorganiza mostrando como ficaria ao soltar.
  const exibicao = useMemo(() => {
    if (!editando || !fantasma) return itens.map((id, i) => ({ id, fantasma: false, posSem: i }))
    const sem = itens.filter((x) => x !== fantasma.id).map((id, i) => ({ id, fantasma: false, posSem: i }))
    const pos = Math.min(fantasma.pos, sem.length)
    sem.splice(pos, 0, { id: fantasma.id, fantasma: true, posSem: -1 })
    return sem
  }, [itens, editando, fantasma])

  const m = dados?.metricas
  const impostoManual = dados?.bruto?.config?.imposto_meta_usar_manual

  const renderGrafico = (id) => {
    if (!dados) return null
    switch (id) {
      case 'evolucaoLucro': return <GraficoLucro serie={dados.serie} />
      case 'pagamentos': return <GraficoPagamentos dados={dados.pagamentos} />
      case 'vendasHorario': return <GraficoHorario dados={dados.porHorario} modo="vendas" />
      case 'lucroHorario': return <GraficoHorario dados={dados.lucroHorario} modo="lucro" />
      case 'funil': return <FunilConversao etapas={dados.funil} />
      default: return null
    }
  }

  const renderItem = (item) => {
    const defMetrica = metricaPorId(item.id)
    const defGrafico = defMetrica ? null : graficoPorId(item.id)
    if (!defMetrica && !defGrafico) return null

    const classes = [
      defGrafico ? `item-grafico ${GRAFICOS_LARGOS.has(item.id) ? 'largo' : ''}` : 'envelope-card',
      editando ? 'arrastavel' : '',
      item.fantasma ? 'fantasma' : '',
    ].join(' ')

    return (
      <div
        key={item.id}
        className={classes}
        style={item.fantasma ? { pointerEvents: 'none' } : undefined}
        draggable={editando && !item.fantasma}
        onDragStart={editando ? (e) => {
          e.dataTransfer.setData('text/plain', item.id)
          e.dataTransfer.effectAllowed = 'move'
          aoIniciarArrasto({ origem: 'grade', id: item.id })
        } : undefined}
        onDragOver={editando ? (e) => sobreItem(e, item.posSem, !!defGrafico) : undefined}
        onDragEnd={editando ? limparArrasto : undefined}
      >
        {editando && !item.fantasma && (
          <button className="remover-card" title="Remover" onClick={() => alternarItem(item.id)}>×</button>
        )}
        {defMetrica ? (
          <CardMetrica
            rotulo={defMetrica.rotulo}
            valor={formatarValor(defMetrica, m[item.id])}
            cor={corDaMetrica(defMetrica, m[item.id])}
            selo={defMetrica.selo || (item.id === 'impostoAds' ? (impostoManual ? 'manual' : 'auto') : undefined)}
            descricao={defMetrica.descricao}
          />
        ) : renderGrafico(item.id)}
      </div>
    )
  }

  const conteudoPrincipal = dados && (
    <>
      <div className="card card-lucro-principal">
        <div>
          <div className="rotulo">Lucro líquido real</div>
          <div className={`valor ${m.lucro >= 0 ? 'positivo' : 'negativo'}`}>
            {moeda(m.lucro)}
          </div>
        </div>
        <div className="texto-suave">
          {m.numVendas} venda{m.numVendas !== 1 ? 's' : ''} aprovada{m.numVendas !== 1 ? 's' : ''} no período
        </div>
      </div>

      <div
        className={`grade-dashboard ${editando ? 'em-edicao' : ''}`}
        onDragOver={(e) => { if (arrasto.current) e.preventDefault() }}
        onDrop={editando ? soltarNaGrade : undefined}
      >
        {exibicao.map(renderItem)}
        {editando && itens.length === 0 && (
          <div className="grade-vazia">Arraste métricas e gráficos do painel para cá</div>
        )}
      </div>
    </>
  )

  return (
    <div>
      {editando && (
        <div className="barra-edicao">
          <span className="barra-edicao-texto">Você está editando esse dashboard</span>
          <div className="barra-edicao-acoes">
            <button className="botao secundario pequeno" onClick={redefinir}>Redefinir configurações</button>
            <button className="botao secundario pequeno" onClick={cancelar}>Cancelar</button>
            <button className="botao destaque pequeno" onClick={salvarEdicao}>Salvar</button>
          </div>
        </div>
      )}

      <div className="cabecalho-dashboard">
        <h1 className="titulo-pagina">Dashboard</h1>
        {!editando && (
          <button className="botao secundario pequeno" onClick={iniciarEdicao} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <IconeLapis /> Editar
          </button>
        )}
      </div>
      <SeletorPeriodo periodo={periodo} />

      {erro && <div className="erro-msg">{erro}</div>}

      {carregando && !dados ? (
        <>
          <div className="card card-lucro-principal"><div className="skeleton" style={{ height: 60, width: '100%' }} /></div>
          <div className="grade-dashboard">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="card card-metrica" key={i}><div className="skeleton" style={{ height: 40 }} /></div>
            ))}
          </div>
        </>
      ) : editando ? (
        <div className="layout-edicao">
          <PainelEdicao
            itens={rascunho}
            aoAlternarItem={alternarItem}
            aoIniciarArrasto={aoIniciarArrasto}
          />
          <div className="area-edicao">{conteudoPrincipal}</div>
        </div>
      ) : (
        conteudoPrincipal
      )}
    </div>
  )
}
