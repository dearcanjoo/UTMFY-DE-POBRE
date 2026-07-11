import { useState } from 'react'

// Passo a passo mostrado para quem ainda não conectou a integração.
// Recolhível para não poluir a tela de quem já sabe o caminho.
export default function TutorialIntegracao({ titulo = 'Como conectar', passos = [], nota }) {
  const [aberto, setAberto] = useState(true)
  return (
    <div className="tutorial">
      <button type="button" className="tutorial-cabecalho" onClick={() => setAberto((v) => !v)}>
        <span className="tutorial-titulo">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          {titulo}
        </span>
        <svg className={`tutorial-seta ${aberto ? 'aberto' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {aberto && (
        <ol className="tutorial-passos">
          {passos.map((p, i) => (
            <li key={i}><span className="tutorial-num">{i + 1}</span><span>{p}</span></li>
          ))}
          {nota && <p className="tutorial-nota">{nota}</p>}
        </ol>
      )}
    </div>
  )
}
