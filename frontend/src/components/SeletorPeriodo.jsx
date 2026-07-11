import { PRESETS } from '../hooks/usePeriodo.js'

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
          <input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} />
          <input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} />
        </div>
      )}
    </>
  )
}
