import { moeda } from '../lib/formato.js'

export default function TabelaProdutos({ porProduto }) {
  if (!porProduto || porProduto.length === 0) {
    return <div className="card texto-suave">Nenhuma venda no período. Os produtos aparecem aqui automaticamente quando as vendas da Cakto chegam.</div>
  }
  const ordenados = [...porProduto].sort((a, b) => b.faturamento - a.faturamento)
  return (
    <div className="lista-produtos">
      {ordenados.map((p) => (
        <div className="card produto-linha" key={p.chave}>
          <div>
            <div className="produto-nome">{p.nome}</div>
            <div className="produto-sub">
              {p.numVendas} venda{p.numVendas !== 1 ? 's' : ''}
              {p.numVendas > 0 && ` · Ticket médio ${moeda(p.faturamento / p.numVendas)}`}
            </div>
          </div>
          <div className="produto-numeros">
            <div className="produto-lucro positivo">{moeda(p.faturamento)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
