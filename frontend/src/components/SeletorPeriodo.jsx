import { PRESETS } from '../hooks/usePeriodo.js'
import MiniCalendario from './MiniCalendario.jsx'
import { formataDataCurta } from '../lib/formato.js'

export default function SeletorPeriodo({ periodo }) {
  const { preset, setPreset, customInicio, setCustomInicio, customFim, setCustomFim } = periodo
  return (
    <>
      <div className="seletor-periodo">
        {PRESETS.map((p) => (
          <button key={p.id} className={preset === p.id ? 'ativo' : ''} onClick={() => setPreset(p.id)}>
            {p.rotulo}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="datas-custom">
          <MiniCalendario
            inicio={customInicio}
            fim={customFim}
            onChange={(i, f) => { setCustomInicio(i); setCustomFim(f) }}
          />
          <div className="texto-suave" style={{ fontSize: 12, marginTop: 6 }}>
            Período: {formataDataCurta(customInicio)} até {formataDataCurta(customFim)}
          </div>
        </div>
      )}
    </>
  )
}
