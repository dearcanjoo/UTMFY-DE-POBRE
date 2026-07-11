import { moeda, num } from '../lib/formato.js'

export default function TabelaProdutos({ porProduto }) {
  if (!porProduto || porProduto.length === 0) {
    return <div className="card texto-suave">Nenhuma venda no período. Os produtos aparecem aqui automaticamente quando as vendas da Cakto chegam.</div>
  }
  return (
    <div className="lista-produtos">
      {porProduto.map((p) => (
        <div className="card produto-linha" key={p.chave}>
          <div>
            <div className="produto-nome">{p.nome}</div>
            <div className="produto-sub">
              {p.numVendas} venda{p.numVendas !== 1 ? 's' : ''} · Fat. {moeda(p.faturamento)} · Ads {moeda(p.gastoAds + p.impostoAds)}
              {p.roas != null && ` · ROAS ${num(p.roas)}`}
              {!p.contaAds && ' · sem conta de ads associada'}
            </div>
          </div>
          <div className="produto-numeros">
            <div className={`produto-lucro ${p.lucro >= 0 ? 'positivo' : 'negativo'}`}>{moeda(p.lucro)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
