import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { pct } from '../lib/formato.js'

const CORES = { pix: '#0da566', cartao: '#f2c53d', boleto: '#1a2420', outros: '#93a19a' }

export default function GraficoPagamentos({ dados }) {
  const temDados = dados && dados.length > 0
  return (
    <div className="card card-grafico">
      <div className="titulo-grafico">Vendas por pagamento</div>
      {!temDados ? (
        <div className="grafico-vazio">Sem vendas aprovadas no período</div>
      ) : (
        <div className="corpo-grafico-pizza">
          <div style={{ width: '55%', height: 190 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="qtd"
                  nameKey="nome"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {dados.map((d) => <Cell key={d.id} fill={CORES[d.id] || CORES.outros} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#fff', border: '1px solid #e2e7e4', borderRadius: 10,
                    color: '#161d18', boxShadow: '0 4px 16px rgba(28,33,28,0.08)', fontSize: 12,
                  }}
                  formatter={(v, nome, item) => [`${v} venda${v !== 1 ? 's' : ''} (${pct(item?.payload?.pct, 1)})`, nome]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legenda-pizza">
            {dados.map((d) => (
              <div className="legenda-item" key={d.id}>
                <span className="legenda-cor" style={{ background: CORES[d.id] || CORES.outros }} />
                <span className="legenda-nome">{d.nome}</span>
                <span className="legenda-valor">{pct(d.pct, 1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
