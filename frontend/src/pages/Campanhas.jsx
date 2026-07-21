import { useState, useMemo } from 'react'
import { usePeriodo } from '../hooks/usePeriodo.js'
import { useCampanhas, estaAtivo, rotuloStatus } from '../hooks/useCampanhas.js'
import { supabase, FUNCTIONS_URL } from '../lib/supabase.js'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import { moeda, num } from '../lib/formato.js'

const NIVEIS = ['Campanhas', 'Conjuntos', 'Anúncios']

// Aba Campanhas (administração de tráfego — visualização):
// navegação em níveis, igual ao Gerenciador do Meta: clica na campanha
// para entrar nos conjuntos, clica no conjunto para entrar nos anúncios.
export default function Campanhas() {
  const periodo = usePeriodo()
  const [conta, setConta] = useState('') // '' = todas as contas
  const [filtroStatus, setFiltroStatus] = useState('ativas') // 'ativas' | 'todas'
  const { dados, contas, carregando, erro, recarregar } = useCampanhas(periodo.inicio, periodo.fim, conta || null)
  const [caminho, setCaminho] = useState([]) // [] | [campanha] | [campanha, conjunto]
  const [atualizando, setAtualizando] = useState(false)

  // Ao trocar período/conta, os nós são recriados: volta para a raiz por id
  const nivel = caminho.length
  const listaBase = useMemo(() => {
    if (!dados) return []
    if (nivel === 0) return dados.arvore
    const camp = dados.arvore.find((c) => c.id === caminho[0]?.id)
    if (!camp) return []
    if (nivel === 1) return camp.filhos
    const conj = camp.filhos.find((s) => s.id === caminho[1]?.id)
    return conj ? conj.filhos : []
  }, [dados, caminho, nivel])

  // Filtro Ativas: em cada nível, esconde itens não ativos
  const lista = useMemo(
    () => (filtroStatus === 'todas' ? listaBase : listaBase.filter((n) => estaAtivo(n.status))),
    [listaBase, filtroStatus],
  )
  const ocultos = listaBase.length - lista.length

  const totais = useMemo(() => lista.reduce(
    (t, n) => ({
      gasto: t.gasto + n.gasto,
      vendas: t.vendas + n.vendas,
      faturamento: t.faturamento + n.faturamento,
    }),
    { gasto: 0, vendas: 0, faturamento: 0 },
  ), [lista])

  const entrar = (no) => { if (nivel < 2) setCaminho([...caminho, { id: no.id, nome: no.nome }]) }
  const voltarPara = (idx) => setCaminho(caminho.slice(0, idx))

  // Botão Atualizar: dispara o sync do Meta e recarrega os dados
  async function atualizar() {
    setAtualizando(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      await fetch(`${FUNCTIONS_URL}/sync-meta-spend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      })
    } catch { /* sem rede/token: só recarrega o que tem */ }
    recarregar()
    setAtualizando(false)
  }

  const rotuloColuna = nivel === 0 ? 'Campanha' : nivel === 1 ? 'Conjunto' : 'Anúncio'

  return (
    <div>
      <div className="cabecalho-dashboard">
        <h1 className="titulo-pagina">Campanhas</h1>
        <button className="botao secundario pequeno" onClick={atualizar} disabled={atualizando}>
          {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      <SeletorPeriodo periodo={periodo} />

      <div className="filtros-campanhas">
        <div className="alternador-status">
          <button className={filtroStatus === 'ativas' ? 'ativo' : ''} onClick={() => setFiltroStatus('ativas')}>
            Ativas
          </button>
          <button className={filtroStatus === 'todas' ? 'ativo' : ''} onClick={() => setFiltroStatus('todas')}>
            Todas
          </button>
        </div>
        {contas.length > 1 && (
          <select className="seletor-conta" value={conta} onChange={(e) => { setConta(e.target.value); setCaminho([]) }}>
            <option value="">Todas as contas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
        {ocultos > 0 && filtroStatus === 'ativas' && (
          <span className="texto-suave" style={{ fontSize: 12 }}>
            {ocultos} desativad{nivel === 0 ? 'a' : 'o'}{ocultos !== 1 ? 's' : ''} ocult{nivel === 0 ? 'a' : 'o'}{ocultos !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Trilha de navegação (campanha > conjunto > anúncio) */}
      <div className="trilha-campanhas">
        <button className={`trilha-item ${nivel === 0 ? 'atual' : ''}`} onClick={() => voltarPara(0)}>
          {NIVEIS[0]}
        </button>
        {caminho.map((p, i) => (
          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="trilha-separador">›</span>
            <button
              className={`trilha-item ${i === caminho.length - 1 ? 'atual' : ''}`}
              onClick={() => voltarPara(i + 1)}
              title={p.nome}
            >
              {p.nome}
            </button>
          </span>
        ))}
      </div>

      {erro && <div className="erro-msg">{erro}</div>}

      {carregando ? (
        <div className="card tabela-campanhas-envelope" style={{ padding: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="skeleton" key={i} style={{ height: 34, marginBottom: 8 }} />
          ))}
        </div>
      ) : dados && dados.arvore.length === 0 ? (
        <div className="card estado-vazio">
          <div className="estado-vazio-titulo">Nenhum dado de anúncio neste período</div>
          <div className="texto-suave">
            Os insights por anúncio chegam junto com a sincronização do Meta.
            Clique em "Atualizar" acima ou aguarde a sincronização automática.
          </div>
        </div>
      ) : lista.length === 0 ? (
        <div className="card estado-vazio">
          <div className="estado-vazio-titulo">
            {filtroStatus === 'ativas' ? `Nenhum item ativo aqui` : 'Nada por aqui'}
          </div>
          <div className="texto-suave">
            {filtroStatus === 'ativas' && listaBase.length > 0
              ? `Existem ${listaBase.length} desativado${listaBase.length !== 1 ? 's' : ''} com dados no período. Clique em "Todas" para ver.`
              : 'Sem dados neste nível para o período selecionado.'}
          </div>
        </div>
      ) : (
        <>
          <div className="card tabela-campanhas-envelope">
            <table className="tabela-campanhas">
              <thead>
                <tr>
                  <th className="col-nome">{rotuloColuna}</th>
                  <th>Orçamento</th>
                  <th>Gasto</th>
                  <th>Vis. de página</th>
                  <th>ICs</th>
                  <th>Vendas</th>
                  <th>Faturamento</th>
                  <th>ROAS</th>
                  <th>CPA</th>
                  <th>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((no) => (
                  <Linha key={no.id} no={no} podeEntrar={nivel < 2} aoEntrar={() => entrar(no)} />
                ))}
                <tr className="linha-total">
                  <td className="col-nome">Total</td>
                  <td />
                  <td>{moeda(totais.gasto)}</td>
                  <td colSpan={2} />
                  <td>{totais.vendas}</td>
                  <td>{moeda(totais.faturamento)}</td>
                  <td>{totais.gasto > 0 ? num(totais.faturamento / totais.gasto) : '—'}</td>
                  <td>{totais.vendas > 0 ? moeda(totais.gasto / totais.vendas) : '—'}</td>
                  <td className={totais.faturamento - totais.gasto >= 0 ? 'positivo' : 'negativo'}>
                    {moeda(totais.faturamento - totais.gasto)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="notas-atribuicao texto-suave">
            <span>Vendas atribuídas pela UTM da compra (dado real da Cakto, não estimativa do Meta). </span>
            {dados.semUtm > 0 && (
              <span>{dados.semUtm} venda{dados.semUtm !== 1 ? 's' : ''} sem UTM no período (orgânico ou link direto). </span>
            )}
            {dados.naoAtribuidas > 0 && (
              <span>
                {dados.naoAtribuidas} venda{dados.naoAtribuidas !== 1 ? 's' : ''} com UTM que não casou com
                anúncios {conta ? 'desta conta' : 'do período'} ({moeda(dados.naoAtribuidasFat)}).
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Linha({ no, podeEntrar, aoEntrar }) {
  const roas = no.gasto > 0 ? no.faturamento / no.gasto : null
  const cpa = no.vendas > 0 ? no.gasto / no.vendas : null
  const lucro = no.faturamento - no.gasto
  const selo = rotuloStatus(no.status)

  return (
    <tr
      className={`${podeEntrar ? 'expansivel' : ''} ${!estaAtivo(no.status) ? 'inativa' : ''}`}
      onClick={podeEntrar ? aoEntrar : undefined}
    >
      <td className="col-nome">
        <span className="nome-no" title={no.nome}>{no.nome}</span>
        {selo && <span className="selo-status">{selo}</span>}
        {podeEntrar && <span className="entrar-seta">›</span>}
      </td>
      <td className="texto-suave">{no.orcamento != null ? `${moeda(no.orcamento)}/dia` : '—'}</td>
      <td>{moeda(no.gasto)}</td>
      <td>{no.vps}</td>
      <td>{no.ics}</td>
      <td>{no.vendas}</td>
      <td>{moeda(no.faturamento)}</td>
      <td className={roas != null ? (roas >= 1 ? 'positivo' : 'negativo') : ''}>{roas != null ? num(roas) : '—'}</td>
      <td>{cpa != null ? moeda(cpa) : '—'}</td>
      <td className={lucro >= 0 ? 'positivo' : 'negativo'}>{moeda(lucro)}</td>
    </tr>
  )
}
