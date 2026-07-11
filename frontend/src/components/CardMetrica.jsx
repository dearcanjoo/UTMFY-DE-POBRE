export default function CardMetrica({ rotulo, valor, cor, selo, descricao }) {
  const classeCor = cor === 'verde' ? 'positivo' : cor === 'vermelho' ? 'negativo' : ''
  return (
    <div className="card card-metrica">
      <div className="rotulo">
        {rotulo}
        {selo && <span className={`selo ${selo}`}>{selo === 'info' ? 'informativo' : selo === 'auto' ? 'automático' : 'manual'}</span>}
        {descricao && (
          <span className="info-dica" aria-label={descricao}>
            i
            <span className="info-balao">{descricao}</span>
          </span>
        )}
      </div>
      <div className={`valor ${classeCor}`}>{valor}</div>
    </div>
  )
}
