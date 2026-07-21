import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { moeda, formataDataCurta, somaDias, TZ } from '../lib/formato.js'

const CORES = ['#0da566', '#f2c53d', '#1a2420', '#4a90d9', '#dd4a2f']
const MAX_PRODUTOS = 5

const diaDe = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts))

// Faturamento diário por produto — mostra qual produto mais vende no período.
export default function GraficoProdutos({ vendas, inicio, fim }) {
  const { dados, produtos } = useMemo(() => {
    const aprovadas = (vendas ?? []).filter((v) => v.status === 'aprovada')

    // top produtos por faturamento no período
    const porProduto = new Map()
    for (const v of aprovadas) {
      const nome = v.produto_nome || 'Sem nome'
      porProduto.set(nome, (porProduto.get(nome) || 0) + (Number(v.valor_comissao) || 0))
    }
    const top = [...porProduto.entries()].sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PRODUTOS).map(([nome]) => nome)

    // um ponto por dia do período, uma linha por produto
    const dias = []
    for (let d = inicio; d <= fim; d = somaDias(d, 1)) dias.push(d)
    const base = new Map(dias.map((d) => [d, Object.fromEntries(top.map((p) => [p, 0]))]))
    for (const v of aprovadas) {
      const dia = diaDe(v.data_venda)
      const nome = v.produto_nome || 'Sem nome'
      if (base.has(dia) && top.includes(nome)) base.get(dia)[nome] += Number(v.valor_comissao) || 0
    }
    return {
      dados: dias.map((d) => ({ dia: formataDataCurta(d), ...base.get(d) })),
      produtos: top,
    }
  }, [vendas, inicio, fim])

  if (!produtos.length) return null

  return (
    <div className="card card-grafico" style={{ marginTop: 14 }}>
      <div className="titulo-grafico">Faturamento por produto</div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={dados} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e7e4" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" stroke="#68746e" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#68746e" fontSize={11} tickLine={false} axisLine={false} width={60}
              tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`} />
            <Tooltip
              contentStyle={{
                background: '#fff', border: '1px solid #e2e7e4', borderRadius: 10,
                color: '#161d18', boxShadow: '0 4px 16px rgba(28,33,28,0.08)', fontSize: 12,
              }}
              formatter={(v, nome) => [moeda(v), nome]}
              labelFormatter={(l) => `Dia ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11.5 }} />
            {produtos.map((p, i) => (
              <Line key={p} type="monotone" dataKey={p} stroke={CORES[i % CORES.length]}
                strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
