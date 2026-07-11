import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, FUNCTIONS_URL } from '../lib/supabase.js'

const META_APP_ID = import.meta.env.VITE_META_APP_ID
const META_SCOPES = 'ads_read,read_insights'

export default function Integracoes({ usuario }) {
  const [conexoes, setConexoes] = useState({})
  const [clientIdCakto, setClientIdCakto] = useState('')
  const [clientSecretCakto, setClientSecretCakto] = useState('')
  const [msg, setMsg] = useState(null)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [params, setParams] = useSearchParams()

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('conexoes').select('*')
    const mapa = {}
    for (const c of data || []) mapa[c.provedor] = c
    setConexoes(mapa)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Retorno do OAuth do Meta (?code=...)
  useEffect(() => {
    const code = params.get('code')
    if (!code) return
    setParams({}, { replace: true })
    trocarCodigoMeta(code)
  }, []) // eslint-disable-line

  async function chamarFuncao(nome, corpo) {
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/${nome}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sess.session.access_token}`,
      },
      body: JSON.stringify(corpo || {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `Erro na função ${nome}`)
    return json
  }

  // ===== CAKTO =====
  async function salvarCakto(e) {
    e.preventDefault()
    setOcupado(true); setErro(null); setMsg(null)
    try {
      // preserva o webhook_secret existente para não invalidar a URL já cadastrada na Cakto
      const segredo = conexoes.cakto?.contas_selecionadas?.[0]?.webhook_secret
        || crypto.randomUUID().replaceAll('-', '')
      await supabase.from('conexoes').upsert({
        usuario_id: usuario.id,
        provedor: 'cakto',
        client_id: clientIdCakto.trim(),
        token_acesso: clientSecretCakto.trim(),
        status: 'conectado',
        contas_ads: [],
        contas_selecionadas: [{ webhook_secret: segredo }],
      }, { onConflict: 'usuario_id,provedor' })
      setClientIdCakto(''); setClientSecretCakto('')
      setMsg('Cakto conectada! Configure o webhook abaixo no painel da Cakto.')
      carregar()
    } catch (err) { setErro(err.message) } finally { setOcupado(false) }
  }

  async function sincronizarCakto() {
    setOcupado(true); setErro(null); setMsg(null)
    try {
      const r = await chamarFuncao('sync-cakto')
      setMsg(`Sincronização concluída: ${r.importadas ?? 0} vendas importadas/atualizadas.`)
    } catch (err) { setErro(err.message) } finally { setOcupado(false) }
  }

  // ===== META =====
  function conectarMeta() {
    const redirect = `${window.location.origin}/integracoes`
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&scope=${META_SCOPES}&response_type=code`
    window.location.href = url
  }

  async function trocarCodigoMeta(code) {
    setOcupado(true); setErro(null); setMsg(null)
    try {
      const redirect = `${window.location.origin}/integracoes`
      await chamarFuncao('oauth-meta', { code, redirect_uri: redirect })
      setMsg('Meta Ads conectado! Escolha abaixo as contas de anúncios para acompanhar.')
      carregar()
    } catch (err) { setErro(err.message) } finally { setOcupado(false) }
  }

  async function alternarConta(contaId) {
    const meta = conexoes.meta
    const sel = new Set((meta.contas_selecionadas || []).map(String))
    sel.has(contaId) ? sel.delete(contaId) : sel.add(contaId)
    await supabase.from('conexoes').update({ contas_selecionadas: [...sel] }).eq('id', meta.id)
    carregar()
  }

  async function sincronizarMeta() {
    setOcupado(true); setErro(null); setMsg(null)
    try {
      const r = await chamarFuncao('sync-meta-spend')
      setMsg(`Gastos sincronizados: ${r.dias ?? 0} registros de gasto atualizados.`)
    } catch (err) { setErro(err.message) } finally { setOcupado(false) }
  }

  async function renovarTokenMeta() {
    setOcupado(true); setErro(null); setMsg(null)
    try {
      await chamarFuncao('refresh-token-meta')
      setMsg('Token do Meta renovado por mais 60 dias.')
      carregar()
    } catch (err) {
      setErro('Não foi possível renovar automaticamente. Reconecte com o Facebook.')
    } finally { setOcupado(false) }
  }

  const cakto = conexoes.cakto
  const meta = conexoes.meta
  const webhookSecret = cakto?.contas_selecionadas?.[0]?.webhook_secret
  const webhookUrl = webhookSecret
    ? `${FUNCTIONS_URL}/webhook-cakto?u=${usuario.id}&s=${webhookSecret}`
    : null
  const metaExpirando = meta?.token_expira_em && (new Date(meta.token_expira_em) - Date.now()) < 7 * 86400000
  const contasSel = new Set((meta?.contas_selecionadas || []).map(String))

  return (
    <div>
      <h1 className="titulo-pagina">Integrações</h1>
      {erro && <div className="erro-msg">{erro}</div>}
      {msg && <div className="sucesso-msg">{msg}</div>}

      {/* ===== CAKTO ===== */}
      <div className="card secao">
        <div className="linha-flex" style={{ marginBottom: 12 }}>
          <div className="subtitulo" style={{ marginBottom: 0 }}>
            <span className={`status-bolinha ${cakto?.status === 'conectado' ? 'conectado' : 'desconectado'}`} />
            Cakto
          </div>
          {cakto?.status === 'conectado' && (
            <button className="botao secundario pequeno" onClick={sincronizarCakto} disabled={ocupado}>
              Sincronizar vendas
            </button>
          )}
        </div>
        <form onSubmit={salvarCakto}>
          <div className="campo">
            <label>Client ID (chave de API da Cakto)</label>
            <input type="text" autoComplete="off" value={clientIdCakto} onChange={(e) => setClientIdCakto(e.target.value)}
              placeholder={cakto?.client_id ? `já configurado (${cakto.client_id.slice(0, 8)}…) — cole para substituir` : 'Cole o Client ID aqui'} />
          </div>
          <div className="campo">
            <label>Client Secret</label>
            <input type="password" autoComplete="new-password" value={clientSecretCakto} onChange={(e) => setClientSecretCakto(e.target.value)}
              placeholder={cakto?.token_acesso ? '••••••••  (já configurado — cole para substituir)' : 'Cole o Client Secret aqui'} />
          </div>
          <button className="botao pequeno" disabled={ocupado || !clientIdCakto.trim() || !clientSecretCakto.trim()}>
            Salvar credenciais
          </button>
        </form>
        {webhookUrl && (
          <div style={{ marginTop: 14 }}>
            <div className="texto-suave" style={{ marginBottom: 6 }}>
              URL do webhook — cadastre no painel da Cakto (eventos: compra aprovada, reembolso, chargeback):
            </div>
            <div className="card bloco-inset" style={{ padding: 10, fontSize: 12, wordBreak: 'break-all', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {webhookUrl}
            </div>
            <button className="botao secundario pequeno" style={{ marginTop: 8 }}
              onClick={() => { navigator.clipboard.writeText(webhookUrl); setMsg('URL copiada!') }}>
              Copiar URL
            </button>
          </div>
        )}
      </div>

      {/* ===== META ADS ===== */}
      <div className="card secao">
        <div className="linha-flex" style={{ marginBottom: 12 }}>
          <div className="subtitulo" style={{ marginBottom: 0 }}>
            <span className={`status-bolinha ${meta?.status === 'conectado' ? (metaExpirando ? 'expirando' : 'conectado') : 'desconectado'}`} />
            Meta Ads
          </div>
          {meta?.status === 'conectado' && (
            <button className="botao secundario pequeno" onClick={sincronizarMeta} disabled={ocupado}>
              Sincronizar gastos
            </button>
          )}
        </div>

        {metaExpirando && (
          <div className="aviso">
            Seu token do Meta expira em breve ({new Date(meta.token_expira_em).toLocaleDateString('pt-BR')}).
            <button className="botao secundario pequeno" style={{ marginLeft: 10 }} onClick={renovarTokenMeta} disabled={ocupado}>Renovar agora</button>
          </div>
        )}

        {!meta || meta.status !== 'conectado' ? (
          <>
            <p className="texto-suave" style={{ marginBottom: 12 }}>
              Conecte com sua conta do Facebook para importar os gastos de anúncios automaticamente (somente leitura).
            </p>
            <button className="botao" onClick={conectarMeta} disabled={ocupado || !META_APP_ID || META_APP_ID.startsWith('COLE')}>
              Conectar com Facebook
            </button>
            {(!META_APP_ID || META_APP_ID.startsWith('COLE')) && (
              <p className="texto-suave" style={{ marginTop: 8 }}>Configure VITE_META_APP_ID no arquivo .env para habilitar.</p>
            )}
          </>
        ) : (
          <>
            <div className="texto-suave" style={{ marginBottom: 10 }}>
              Token válido até {meta.token_expira_em ? new Date(meta.token_expira_em).toLocaleDateString('pt-BR') : '—'}.
              Escolha as contas de anúncios para acompanhar:
            </div>
            {(meta.contas_ads || []).length === 0 && <div className="texto-suave">Nenhuma conta de anúncios encontrada neste login.</div>}
            {(meta.contas_ads || []).map((c) => (
              <label key={c.id} className="card bloco-inset linha-flex" style={{ marginBottom: 8, padding: 12, cursor: 'pointer' }}>
                <span style={{ fontSize: 14 }}>{c.name || c.id} <span className="texto-suave">({c.id})</span></span>
                <input type="checkbox" checked={contasSel.has(String(c.id))} onChange={() => alternarConta(String(c.id))}
                  style={{ width: 20, height: 20, accentColor: 'var(--verde-escuro)' }} />
              </label>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
