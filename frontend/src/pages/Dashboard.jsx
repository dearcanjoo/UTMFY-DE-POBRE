import { useState, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { usePeriodo } from '../hooks/usePeriodo.js'
import { useMetricas } from '../hooks/useMetricas.js'
import { usePreferencias } from '../hooks/usePreferencias.js'
import { metricaPorId, formatarValor, corDaMetrica, METRICAS_PADRAO, GRAFICOS_PADRAO } from '../lib/metricas.js'
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
  const { metricas: metricasSalvas, graficos: graficosSalvos, salvar } = usePreferencias(usuario)

  // ===== Modo de edição (estilo UTMify) =====
  const [editando, setEditando] = useState(false)
  const [rascunhoMetricas, setRascunhoMetricas] = useState([])
  const [rascunhoGraficos, setRascunhoGraficos] = useState([])
  const arrasto = useRef(null) // { tipo, origem: 'painel'|'grade', id, index }
  const alvoRef = useRef(null) // posição de inserção lida no drop (evita estado defasado)
  const [alvoDrop, setAlvoDrop] = useState(null) // índice onde o item seria inserido (indicador visual)

  const metricas = editando ? rascunhoMetricas : metricasSalvas
  const graficos = editando ? rascunhoGraficos : graficosSalvos

  const iniciarEdicao = () => {
    setRascunhoMetricas(metricasSalvas)
    setRascunhoGraficos(graficosSalvos)
    setEditando(true)
  }
  const cancelar = () => { setEditando(false); setAlvoDrop(null) }
  const redefinir = () => { setRascunhoMetricas(METRICAS_PADRAO); setRascunhoGraficos(GRAFICOS_PADRAO) }
  const salvarEdicao = async () => {
    await salvar({ metricas: rascunhoMetricas, graficos: rascunhoGraficos })
    setEditando(false)
    setAlvoDrop(null)
  }

  const alternarMetrica = (id) => {
    setRascunhoMetricas((atual) => atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id])
  }
  const alternarGrafico = (id) => {
    setRascunhoGraficos((atual) => atual.includes(id) ? atual.filter((g) => g !== id) : [...atual, id])
  }

  // ===== Arrastar e soltar (HTML5 DnD) =====
  const aoIniciarArrasto = useCallback((info) => { arrasto.current = info }, [])

  const sobreCard = (e, index) => {
    if (!arrasto.current || arrasto.current.tipo !== 'metrica') return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const depois = e.clientX - rect.left > rect.width / 2
    const pos = index + (depois ? 1 : 0)
    alvoRef.current = pos
    setAlvoDrop(pos)
  }

  const soltarNaGrade = (e) => {
    e.preventDefault()
    const info = arrasto.current
    arrasto.current = null
    const destino = alvoRef.current
    alvoRef.current = null
    setAlvoDrop(null)
    if (!info || info.tipo !== 'metrica') return
    setRascunhoMetricas((atual) => {
      const lista = atual.filter((m) => m !== info.id)
      let pos = destino == null ? lista.length : destino
      // ajusta a posição quando o item removido estava antes do destino
      if (info.origem === 'grade' && info.index < (destino ?? atual.length)) pos = Math.max(0, pos - 1)
      pos = Math.min(pos, lista.length)
      lista.splice(pos, 0, info.id)
      return lista
    })
  }

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
        className={`grade-metricas ${editando ? 'em-edicao' : ''}`}
        onDragOver={(e) => { if (arrasto.current?.tipo === 'metrica') e.preventDefault() }}
        onDrop={soltarNaGrade}
      >
        {metricas.map((id, index) => {
          const def = metricaPorId(id)
          if (!def) return null
          const valor = m[id]
          const selo = def.selo || (id === 'impostoAds' ? (impostoManual ? 'manual' : 'auto') : undefined)
          return (
            <div
              key={id}
              className={`envelope-card ${editando ? 'arrastavel' : ''} ${alvoDrop === index ? 'drop-antes' : ''} ${alvoDrop === index + 1 && index === metricas.length - 1 ? 'drop-depois' : ''}`}
              draggable={editando}
              onDragStart={editando ? (e) => {
                e.dataTransfer.setData('text/plain', id)
                e.dataTransfer.effectAllowed = 'move'
                aoIniciarArrasto({ tipo: 'metrica', origem: 'grade', id, index })
              } : undefined}
              onDragOver={editando ? (e) => sobreCard(e, index) : undefined}
              onDragEnd={editando ? () => { arrasto.current = null; alvoRef.current = null; setAlvoDrop(null) } : undefined}
            >
              {editando && (
                <button className="remover-card" title="Remover" onClick={() => alternarMetrica(id)}>×</button>
              )}
              <CardMetrica
                rotulo={def.rotulo}
                valor={formatarValor(def, valor)}
                cor={corDaMetrica(def, valor)}
                selo={selo}
                descricao={def.descricao}
              />
            </div>
          )
        })}
        {editando && metricas.length === 0 && (
          <div className="grade-vazia">Arraste métricas do painel para cá</div>
        )}
      </div>

      <div className="grade-graficos">
        {graficos.map((id) => (
          <div key={id} className={`envelope-grafico ${GRAFICOS_LARGOS.has(id) ? 'largo' : ''}`}>
            {editando && (
              <button className="remover-card" title="Remover" onClick={() => alternarGrafico(id)}>×</button>
            )}
            {renderGrafico(id)}
          </div>
        ))}
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
          <div className="grade-metricas">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="card card-metrica" key={i}><div className="skeleton" style={{ height: 40 }} /></div>
            ))}
          </div>
        </>
      ) : editando ? (
        <div className="layout-edicao">
          <PainelEdicao
            metricas={rascunhoMetricas}
            graficos={rascunhoGraficos}
            aoAlternarMetrica={alternarMetrica}
            aoAlternarGrafico={alternarGrafico}
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
