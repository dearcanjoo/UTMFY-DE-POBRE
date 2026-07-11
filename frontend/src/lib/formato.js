// Formatação e datas — tudo padronizado no fuso de Brasília
export const TZ = 'America/Sao_Paulo'

export function moeda(v) {
  if (v == null || isNaN(v)) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function pct(v, casas = 1) {
  if (v == null || isNaN(v) || !isFinite(v)) return '—'
  return `${(v * 100).toFixed(casas).replace('.', ',')}%`
}

export function num(v, casas = 2) {
  if (v == null || isNaN(v) || !isFinite(v)) return '—'
  return v.toFixed(casas).replace('.', ',')
}

// Data de "hoje" no fuso de Brasília, como YYYY-MM-DD
export function hojeBrasilia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

// Converte YYYY-MM-DD para Date (meia-noite Brasília, expressa em UTC)
export function inicioDoDia(isoDate) {
  return new Date(`${isoDate}T00:00:00-03:00`)
}
export function fimDoDia(isoDate) {
  return new Date(`${isoDate}T23:59:59.999-03:00`)
}

// Soma dias a uma data YYYY-MM-DD
export function somaDias(isoDate, dias) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function formataDataCurta(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

export function diasNoIntervalo(inicio, fim) {
  const a = new Date(`${inicio}T12:00:00Z`)
  const b = new Date(`${fim}T12:00:00Z`)
  return Math.round((b - a) / 86400000) + 1
}

export function diasNoMes(isoDate) {
  const [y, m] = isoDate.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
