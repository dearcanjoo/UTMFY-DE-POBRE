import { useState, useMemo } from 'react'
import { usePeriodo } from '../hooks/usePeriodo.js'
import { useCampanhas, estaAtivo, rotuloStatus } from '../hooks/useCampanhas.js'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import { moeda, num } from '../lib/formato.js'

// Aba Campanhas (administração de tráfego — visualização):
// campanha > conjunto > anúncio, com vendas atribuídas por UTM.
export default function Campanhas() {
  const periodo = usePeriodo()
  const [conta, setConta] = useState('') // '' = todas as contas
  const [filtroStatus, setFiltroStatus] = useState('ativas') // 'ativas' | 'todas'
  const { dados, contas, carregando, erro } = useCampanhas(periodo.inicio, periodo.fim, conta || null)
  const [abertos, setAbertos] = useState(() => new Set())

  const alternar = (chave) => {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  // Filtro Ativas: esconde CAMPANHAS não ativas (conjuntos/anúncios pausados
  // continuam visíveis dentro delas, com selo — igual ao Gerenciador do Meta).
  const arvore = useMemo(() => {
    if (!dados) return []
    if (filtroStatus === 'todas') return dados.arvore
    return dados.arvore.filter((c) => estaAtivo(c.status))
  }, [dados, filtroStatus])

  const ocultas = dados ? dados.arvore.length - arvore.length : 0

  const totais = useMemo(() => arvore.reduce(
    (t, c) => ({
      gasto: t.gasto + c.gasto,
      vendas: t.vendas + c.vendas,
      faturamento: t.faturamento + c.faturamento,
    }),
    { gasto: 0, vendas: 0, faturamento: 0 },
  ), [arvore])

  return (
    <div>
      <div className="cabecalho-dashboard">
        <h1 className="titulo-pagina">Campanhas</h1>
        {dados && arvore.length > 0 && (
          <span className="texto-suave" style={{ fontSize: 12.5 }}>
            {arvore.length} campanha{arvore.length !== 1 ? 's' : ''}
            {ocultas > 0 ? ` · ${ocultas} desativada${ocultas !== 1 ? 's' : ''} oculta${ocultas !== 1 ? 's' : ''}` : ''}
          </span>
        )}
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
          <select className="seletor-conta" value={conta} onChange={(e) => setConta(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
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
            Abra o Dashboard (o sync roda sozinho) ou clique em "Sincronizar gastos"
            na aba Conexões, e volte aqui.
          </div>
        </div>
      ) : dados && arvore.length === 0 ? (
        <div className="card estado-vazio">
          <div className="estado-vazio-titulo">Nenhuma campanha ativa no período</div>
          <div className="texto-suave">
            Existem {dados.arvore.length} campanha{dados.arvore.length !== 1 ? 's' : ''} desativada{dados.arvore.length !== 1 ? 's' : ''} com dados.
            Clique em "Todas" para vê-la{dados.arvore.length !== 1 ? 's' : ''}.
          </div>
        </div>
      ) : dados && (
        <>
          <div className="card tabela-campanhas-envelope">
            <table className="tabela-campanhas">
              <thead>
                <tr>
                  <th className="col-nome">Campanha / Conjunto / Anúncio</th>
                  <th>Gasto</th>
                  <th>Cliques</th>
                  <th>ICs</th>
                  <th>Vendas</th>
                  <th>Faturamento</th>
                  <th>ROAS</th>
                  <th>CPA</th>
                  <th>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {arvore.map((camp) => (
                  <LinhaNo
                    key={camp.id}
                    no={camp}
                    nivel={0}
                    chave={`c:${camp.id}`}
                    abertos={abertos}
                    alternar={alternar}
                  />
                ))}
                <tr className="linha-total">
                  <td className="col-nome">Total</td>
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

function LinhaNo({ no, nivel, chave, abertos, alternar }) {
  const aberto = abertos.has(chave)
  const temFilhos = no.filhos.length > 0
  const roas = no.gasto > 0 ? no.faturamento / no.gasto : null
  const cpa = no.vendas > 0 ? no.gasto / no.vendas : null
  const lucro = no.faturamento - no.gasto
  const selo = rotuloStatus(no.status)

  return (
    <>
      <tr
        className={`nivel-${nivel} ${temFilhos ? 'expansivel' : ''} ${!estaAtivo(no.status) ? 'inativa' : ''}`}
        onClick={temFilhos ? () => alternar(chave) : undefined}
      >
        <td className="col-nome" style={{ paddingLeft: 12 + nivel * 22 }}>
          {temFilhos ? (
            <span className={`seta-expandir ${aberto ? 'aberta' : ''}`}>▸</span>
          ) : (
            <span className="seta-espaco" />
          )}
          <span className="nome-no" title={no.nome}>{no.nome}</span>
          {selo && <span className="selo-status">{selo}</span>}
        </td>
        <td>{moeda(no.gasto)}</td>
        <td>{no.cliques}</td>
        <td>{no.ics}</td>
        <td>{no.vendas}</td>
        <td>{moeda(no.faturamento)}</td>
        <td className={roas != null ? (roas >= 1 ? 'positivo' : 'negativo') : ''}>{roas != null ? num(roas) : '—'}</td>
        <td>{cpa != null ? moeda(cpa) : '—'}</td>
        <td className={lucro >= 0 ? 'positivo' : 'negativo'}>{moeda(lucro)}</td>
      </tr>
      {aberto && no.filhos.map((filho) => (
        <LinhaNo
          key={filho.id}
          no={filho}
          nivel={nivel + 1}
          chave={`${chave}/${filho.id}`}
          abertos={abertos}
          alternar={alternar}
        />
      ))}
    </>
  )
}
