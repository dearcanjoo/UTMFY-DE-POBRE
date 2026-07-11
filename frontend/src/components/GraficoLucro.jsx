import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { moeda, formataDataCurta } from '../lib/formato.js'

const CORES = {
  linha: '#0da566',
  grade: '#e2e7e4',
  eixo: '#68746e',
  tooltipBg: '#ffffff',
  tooltipBorda: '#e2e7e4',
  tooltipTexto: '#161d18',
}

export default function GraficoLucro({ serie }) {
  if (!serie || serie.length === 0) return null
  const dados = serie.map((s) => ({ ...s, diaCurto: formataDataCurta(s.dia) }))
  return (
    <div className="card card-grafico">
      <div className="titulo-grafico">Evolução do lucro</div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={dados} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CORES.linha} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CORES.linha} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CORES.grade} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="diaCurto" stroke={CORES.eixo} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={CORES.eixo} fontSize={11} tickLine={false} axisLine={false} width={60}
              tickFormatter={(v) => `R$${v >= 1000 || v <= -1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`} />
            <Tooltip
              contentStyle={{
                background: CORES.tooltipBg,
                border: `1px solid ${CORES.tooltipBorda}`,
                borderRadius: 10,
                color: CORES.tooltipTexto,
                boxShadow: '0 4px 16px rgba(28,33,28,0.08)',
              }}
              formatter={(v, nome) => [moeda(v), nome === 'lucro' ? 'Lucro' : nome === 'faturamento' ? 'Faturamento' : 'Gasto']}
              labelFormatter={(l) => `Dia ${l}`}
            />
            <ReferenceLine y={0} stroke={CORES.eixo} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="lucro" stroke={CORES.linha} strokeWidth={2.5} fill="url(#gradLucro)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
