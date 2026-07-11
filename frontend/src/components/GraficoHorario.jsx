import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts'
import { moeda } from '../lib/formato.js'

const EIXO = '#68746e'
const GRADE = '#e2e7e4'
const VERDE = '#0da566'
const VERMELHO = '#dd4a2f'

// modo 'vendas': nº de vendas aprovadas por hora do dia (Brasília)
// modo 'lucro': lucro estimado por hora (custos distribuídos nas 24h)
export default function GraficoHorario({ dados, modo = 'vendas' }) {
  const titulo = modo === 'lucro' ? 'Lucro por horário (estimado)' : 'Vendas por horário'
  const chave = modo === 'lucro' ? 'lucro' : 'vendas'
  const temDados = dados && dados.some((d) => (modo === 'lucro' ? d.faturamento !== 0 : d.vendas > 0))
  return (
    <div className="card card-grafico">
      <div className="titulo-grafico" title={modo === 'lucro' ? 'A Meta não informa gasto por hora; o custo do período é distribuído igualmente nas 24h.' : undefined}>
        {titulo}
      </div>
      {!temDados ? (
        <div className="grafico-vazio">Sem dados no período</div>
      ) : (
        <div style={{ width: '100%', height: 190 }}>
          <ResponsiveContainer>
            <BarChart data={dados} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRADE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="hora" stroke={EIXO} fontSize={10} tickLine={false} axisLine={false}
                interval={2} tickFormatter={(h) => `${String(h).padStart(2, '0')}h`}
              />
              <YAxis
                stroke={EIXO} fontSize={10} tickLine={false} axisLine={false} width={48}
                tickFormatter={(v) => modo === 'lucro'
                  ? `R$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`
                  : String(v)}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(18,24,20,0.05)' }}
                contentStyle={{
                  background: '#fff', border: `1px solid ${GRADE}`, borderRadius: 10,
                  color: '#161d18', boxShadow: '0 4px 16px rgba(28,33,28,0.08)', fontSize: 12,
                }}
                formatter={(v) => [modo === 'lucro' ? moeda(v) : v, modo === 'lucro' ? 'Lucro' : 'Vendas']}
                labelFormatter={(h) => `${String(h).padStart(2, '0')}h — ${String((h + 1) % 24).padStart(2, '0')}h`}
              />
              {modo === 'lucro' && <ReferenceLine y={0} stroke={EIXO} strokeDasharray="4 4" />}
              <Bar dataKey={chave} radius={[4, 4, 0, 0]} maxBarSize={18}>
                {dados.map((d, i) => (
                  <Cell key={i} fill={modo === 'lucro' ? (d.lucro >= 0 ? VERDE : VERMELHO) : VERDE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
