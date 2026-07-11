import { pct } from '../lib/formato.js'

// Funil horizontal estilo UTMify: colunas com rótulos em cima e a forma
// do funil desenhada em SVG com curvas suaves entre as etapas.
// Cliques / Vis. de página / ICs vêm da API de Insights da Meta;
// vendas iniciadas e aprovadas vêm da Cakto.
export default function FunilConversao({ etapas }) {
  if (!etapas || etapas.length === 0) return null
  const max = Math.max(...etapas.map((e) => e.valor), 1)
  const base = etapas[0].valor > 0 ? etapas[0].valor : max
  const semMeta = etapas[0].valor === 0 && etapas[1].valor === 0 && etapas[2].valor === 0

  const W = 500
  const H = 150
  const n = etapas.length
  const colW = W / n
  const alturas = etapas.map((e) => {
    const proporcao = e.valor / base
    return e.valor > 0 ? Math.max(proporcao * (H - 10), 6) : 2
  })

  // caminho: começa na borda esquerda, curva entre os centros das colunas, fecha no chão
  const xC = (i) => colW * (i + 0.5)
  let d = `M 0 ${H - alturas[0]} L ${xC(0)} ${H - alturas[0]}`
  for (let i = 0; i < n - 1; i++) {
    const mx = (xC(i) + xC(i + 1)) / 2
    d += ` C ${mx} ${H - alturas[i]}, ${mx} ${H - alturas[i + 1]}, ${xC(i + 1)} ${H - alturas[i + 1]}`
  }
  d += ` L ${W} ${H - alturas[n - 1]} L ${W} ${H} L 0 ${H} Z`

  return (
    <div className="card card-grafico">
      <div className="titulo-grafico">Funil de conversão</div>
      {semMeta && (
        <div className="aviso-funil">
          Cliques, visualizações e ICs aparecem após a próxima sincronização com o Meta Ads.
        </div>
      )}
      <div className="funil-rotulos">
        {etapas.map((e) => (
          <div className="funil-etapa" key={e.id}>
            <div className="funil-nome">{e.nome}</div>
            <div className="funil-pct">{e.valor > 0 || etapas[0].valor > 0 ? pct(e.valor / base, 1) : '—'}</div>
            <div className="funil-valor">{e.valor.toLocaleString('pt-BR')}</div>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="funil-svg" aria-hidden="true">
        <defs>
          <linearGradient id="gradFunil" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0da566" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f2c53d" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {Array.from({ length: n - 1 }, (_, i) => (
          <line key={i} x1={colW * (i + 1)} y1="0" x2={colW * (i + 1)} y2={H} stroke="#e2e7e4" strokeDasharray="4 4" strokeWidth="1" />
        ))}
        <path d={d} fill="url(#gradFunil)" />
      </svg>
    </div>
  )
}
