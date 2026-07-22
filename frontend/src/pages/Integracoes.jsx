import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, FUNCTIONS_URL } from '../lib/supabase.js'
import TutorialIntegracao from '../components/TutorialIntegracao.jsx'

const META_APP_ID = import.meta.env.VITE_META_APP_ID
const META_SCOPES = 'ads_read'

// Código para o campo "Parâmetros de URL" de cada anúncio no Meta Ads.
// As macros {{...}} são preenchidas pelo próprio Meta a cada clique.
const CODIGO_UTM = 'utm_source=FB&utm_campaign={{campaign.name}}|{{campaign.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_content={{ad.name}}|{{ad.id}}&utm_term={{placement}}'

// Script de rastreamento MacacoFy (universal) para as páginas do funil:
//   1. Repassa UTMs + fbclid para links de checkout (Cakto e principais plataformas)
//   2. Dispara InitiateCheckout no clique em qualquer link de checkout,
//      independente do texto do botão (modelo UTMify)
// Configuração opcional nas 3 primeiras linhas — o padrão cobre a maioria dos casos.
const SCRIPT_UTM = `<script>
(function () {
  // ===== Configuração (opcional) =====
  var DISPARAR_IC = true;    // false se o seu Pixel estiver instalado DENTRO do checkout (evita IC duplicado)
  var SELETOR_EXTRA = '';    // botão que não é link? coloque um seletor CSS aqui (ex.: '.botao-comprar')
  var DOMINIOS_EXTRAS = [];  // checkout fora da lista? adicione (ex.: ['meucheckout.com'])
  // ===================================
  var CHECKOUTS = ['cakto','kiwify','hotmart','perfectpay','kirvano','ticto','monetizze','braip',
    'payt','greenn','eduzz','pepper','hubla','lastlink','cartpanda','yampi','appmax','zouti',
    'tribopay','pagtrust','guru','cinqpay','vega'].concat(DOMINIOS_EXTRAS);
  var CAMPOS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ttclid','sck'];
  var CHAVE = 'mcf_utms';

  function ehCheckout(href) {
    if (!href) return false;
    var h = String(href).toLowerCase();
    for (var i = 0; i < CHECKOUTS.length; i++) if (h.indexOf(CHECKOUTS[i]) !== -1) return true;
    return false;
  }

  // 1. Captura e guarda as UTMs da URL (sobrevive a funis de várias páginas)
  var p = new URLSearchParams(location.search);
  var achados = {};
  CAMPOS.forEach(function (k) { if (p.get(k)) achados[k] = p.get(k); });
  if (Object.keys(achados).length) {
    try { localStorage.setItem(CHAVE, JSON.stringify(achados)); } catch (e) {}
  }
  var salvos = {};
  try { salvos = JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) {}

  // 2. Injeta as UTMs em todo link de checkout (inclusive criados depois)
  function aplicar() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (!ehCheckout(a.href)) return;
      try {
        var u = new URL(a.href, location.href);
        CAMPOS.forEach(function (k) { if (salvos[k] && !u.searchParams.get(k)) u.searchParams.set(k, salvos[k]); });
        a.href = u.toString();
      } catch (e) {}
    });
  }
  aplicar();
  document.addEventListener('DOMContentLoaded', aplicar);
  new MutationObserver(aplicar).observe(document.documentElement, { childList: true, subtree: true });

  // 3. InitiateCheckout no clique que leva ao checkout (qualquer texto de botão)
  function marcarIC() {
    if (!window.fbq) return;
    var agora = Date.now();
    var ultimo = 0;
    try { ultimo = Number(sessionStorage.getItem('mcf_ic')) || 0; } catch (e) {}
    if (agora - ultimo < 15000) return; // não repete em cliques seguidos
    try { sessionStorage.setItem('mcf_ic', String(agora)); } catch (e) {}
    fbq('track', 'InitiateCheckout');
  }
  if (DISPARAR_IC) {
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var link = e.target.closest('a[href]');
      if (link && ehCheckout(link.href)) return marcarIC();
      if (SELETOR_EXTRA && e.target.closest(SELETOR_EXTRA)) return marcarIC();
    }, true);
  }
})();
</` + `script>`

export default function Integracoes({ usuario }) {
  const [conexoes, setConexoes] = useState({})
  const [clientIdCakto, setClientIdCakto] = useState('')
  const [clientSecretCakto, setClientSecretCakto] = useState('')
  const [msg, setMsg] = useState(null)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [params, setParams] = useSearchParams()

  // ===== Pixel / API de Conversões (CAPI) =====
  const [pixelId, setPixelId] = useState('')
  const [capiToken, setCapiToken] = useState('')
  const [capiAtivo, setCapiAtivo] = useState(false)
  const [capiCfg, setCapiCfg] = useState(null)
  const [capiEnviados, setCapiEnviados] = useState(0)
  const [capiUltimoErro, setCapiUltimoErro] = useState(null)

  const carregarCapi = useCallback(async () => {
    const { data } = await supabase.from('config_custos')
      .select('pixel_id, capi_ativo').maybeSingle()
    if (data) { setCapiCfg(data); setCapiAtivo(!!data.capi_ativo) }
    const { count } = await supabase.from('vendas')
      .select('id', { count: 'exact', head: true })
      .not('capi_enviado_em', 'is', null)
    setCapiEnviados(count ?? 0)
    const { data: comErro } = await supabase.from('vendas')
      .select('capi_erro').not('capi_erro', 'is', null)
      .order('atualizado_em', { ascending: false }).limit(1)
    setCapiUltimoErro(comErro?.[0]?.capi_erro ?? null)
  }, [])

  useEffect(() => { carregarCapi() }, [carregarCapi])

  async function salvarCapi(e) {
    e.preventDefault()
    setOcupado(true); setErro(null); setMsg(null)
    try {
      const upd = {
        usuario_id: usuario.id,
        capi_ativo: capiAtivo,
        atualizado_em: new Date().toISOString(),
      }
      if (pixelId.trim()) upd.pixel_id = pixelId.trim().replace(/\D/g, '')
      if (capiToken.trim()) upd.capi_token = capiToken.trim()
      const { error } = await supabase.from('config_custos').upsert(upd, { onConflict: 'usuario_id' })
      if (error) throw new Error(error.message)
      setPixelId(''); setCapiToken('')
      setMsg('Configuração do Pixel salva. Novas vendas aprovadas serão enviadas ao Meta automaticamente.')
      carregarCapi()
    } catch (err) { setErro(err.message) } finally { setOcupado(false) }
  }

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

  // ===== DESCONECTAR (Cakto ou Meta) =====
  async function desconectar(prov) {
    const nomes = { cakto: 'Cakto', meta: 'Meta Ads' }
    if (!window.confirm(`Desconectar ${nomes[prov]}? As credenciais salvas serão removidas. Você pode reconectar quando quiser.`)) return
    setOcupado(true); setErro(null); setMsg(null)
    try {
      const alvo = conexoes[prov]
      if (alvo?.id) {
        const { error } = await supabase.from('conexoes').delete().eq('id', alvo.id)
        if (error) throw new Error(error.message)
      }
      setMsg(`${nomes[prov]} desconectada.`)
      carregar()
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
            <div className="linha-botoes">
              <button className="botao secundario pequeno" onClick={sincronizarCakto} disabled={ocupado}>
                Sincronizar vendas
              </button>
              <button className="botao perigo pequeno" onClick={() => desconectar('cakto')} disabled={ocupado}>
                Desconectar
              </button>
            </div>
          )}
        </div>
        {cakto?.status !== 'conectado' && (
          <TutorialIntegracao
            titulo="Como conectar a Cakto"
            passos={[
              'No painel da Cakto, abra Configurações → Integrações / API e gere (ou copie) o seu Client ID e o Client Secret.',
              'Cole os dois valores nos campos abaixo e clique em “Salvar credenciais”.',
              'Uma URL de webhook vai aparecer aqui. Copie essa URL.',
              'No painel da Cakto, cadastre essa URL como webhook e marque os eventos: compra aprovada, reembolso e chargeback.',
              'Volte aqui e clique em “Sincronizar vendas” para importar o histórico. Depois disso, novas vendas chegam sozinhas.',
            ]}
            nota="Usamos as credenciais apenas para ler suas vendas — nunca alteramos nada na sua conta Cakto."
          />
        )}
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
            <div className="linha-botoes">
              <button className="botao secundario pequeno" onClick={sincronizarMeta} disabled={ocupado}>
                Sincronizar gastos
              </button>
              <button className="botao perigo pequeno" onClick={() => desconectar('meta')} disabled={ocupado}>
                Desconectar
              </button>
            </div>
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
            <TutorialIntegracao
              titulo="Como conectar o Meta Ads"
              passos={[
                'Clique em “Conectar com Facebook” abaixo.',
                'Faça login com a conta do Facebook que tem acesso ao Gerenciador de Anúncios.',
                'Autorize o acesso de leitura aos anúncios (ads_read). Não publicamos nem alteramos nada.',
                'De volta aqui, marque quais contas de anúncios você quer acompanhar.',
                'Clique em “Sincronizar gastos” para trazer os valores investidos. Depois disso, a atualização é automática.',
              ]}
              nota="A conexão é somente leitura e o acesso pode ser revogado a qualquer momento nas configurações do Facebook."
            />
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

            <div style={{ marginTop: 18 }}>
              <div className="subtitulo" style={{ fontSize: 13.5 }}>Rastreamento de criativos (UTMs)</div>
              <TutorialIntegracao
                titulo="Como rastrear qual criativo deu venda"
                passos={[
                  'No Gerenciador de Anúncios, edite o anúncio (cada criativo) e role até Rastreamento → Parâmetros de URL. Cole o primeiro código abaixo e publique — o Meta preenche os {{...}} sozinho a cada clique.',
                  'Se o anúncio aponta para uma página de vendas (e não direto para o checkout), cole o segundo código antes do </body> de TODAS as páginas do funil. Ele captura as UTMs e injeta nos links do checkout da Cakto — sem isso, a venda chega sem rastreio.',
                  'Teste: abra sua página com ?utm_source=teste no final da URL, clique no botão de compra e confira se o checkout abriu com utm_source=teste na URL.',
                  'Pronto: cada venda chega com a identidade do criativo e aparece na aba Campanhas (campanha → conjunto → anúncio).',
                ]}
                nota="Anúncio duplicado herda o código com os IDs novos. Renomear campanhas não quebra o rastreio: o casamento é feito pelo ID."
              />
              <div className="texto-suave" style={{ fontSize: 12, margin: '10px 0 6px', fontWeight: 600 }}>1. Parâmetros de URL (colar em cada anúncio)</div>
              <div className="card bloco-inset" style={{ padding: 10, fontSize: 11.5, wordBreak: 'break-all', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {CODIGO_UTM}
              </div>
              <button className="botao secundario pequeno" style={{ marginTop: 8 }}
                onClick={() => { navigator.clipboard.writeText(CODIGO_UTM); setMsg('Código de UTM copiado! Cole nos Parâmetros de URL de cada anúncio.') }}>
                Copiar código de UTM
              </button>

              <div className="texto-suave" style={{ fontSize: 12, margin: '16px 0 6px', fontWeight: 600 }}>
                2. Script de rastreamento (colar antes do &lt;/body&gt; de todas as páginas do funil) — repassa as UTMs ao checkout e marca o InitiateCheckout no clique do botão. Se o seu Pixel estiver instalado dentro do checkout, troque DISPARAR_IC para false na primeira linha.
              </div>
              <div className="card bloco-inset" style={{ padding: 10, fontSize: 10.5, maxHeight: 140, overflow: 'auto', whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {SCRIPT_UTM}
              </div>
              <button className="botao secundario pequeno" style={{ marginTop: 8 }}
                onClick={() => { navigator.clipboard.writeText(SCRIPT_UTM); setMsg('Script copiado! Cole antes do </body> em todas as páginas do funil.') }}>
                Copiar script de repasse
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== PIXEL / API DE CONVERSÕES (CAPI) ===== */}
      <div className="card secao">
        <div className="linha-flex" style={{ marginBottom: 12 }}>
          <div className="subtitulo" style={{ marginBottom: 0 }}>
            <span className={`status-bolinha ${capiCfg?.pixel_id && capiAtivo ? 'conectado' : 'desconectado'}`} />
            Pixel do Meta — API de Conversões
          </div>
          {capiEnviados > 0 && (
            <span className="texto-suave" style={{ fontSize: 12 }}>
              {capiEnviados} compra{capiEnviados !== 1 ? 's' : ''} enviada{capiEnviados !== 1 ? 's' : ''} ao Meta
            </span>
          )}
        </div>

        {!capiCfg?.pixel_id && (
          <TutorialIntegracao
            titulo="Como configurar o envio de compras para o seu Pixel"
            passos={[
              'No Gerenciador de Eventos do Meta, selecione o seu Pixel e copie o ID dele (número no topo).',
              'Ainda no Pixel, abra Configurações → API de Conversões → Gerar token de acesso e copie o token.',
              'Cole os dois valores abaixo, marque "Envio ativo" e salve.',
              'Remova o seu Pixel de dentro da Cakto (lá não dá para desligar só o evento de Compra): o Purchase deve sair somente pelo MacacoFy, senão o Meta conta a mesma venda duas vezes. Mantenha o pixel base na sua página de vendas e dispare o InitiateCheckout no clique do botão de compra.',
              'Pronto: toda venda aprovada na Cakto vira um evento Purchase enviado direto ao seu Pixel pelo servidor, com e-mail, telefone e ID do clique (fbclid) do comprador.',
            ]}
            nota="O Purchase server-side não depende do navegador do cliente: captura Pix pago depois, compras com bloqueador de anúncios e melhora a qualidade de correspondência do Pixel."
          />
        )}

        <form onSubmit={salvarCapi}>
          <div className="campo">
            <label>ID do Pixel</label>
            <input type="text" inputMode="numeric" autoComplete="off" value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder={capiCfg?.pixel_id ? `já configurado (${capiCfg.pixel_id}) — cole para substituir` : 'Ex.: 1234567890123456'} />
          </div>
          <div className="campo">
            <label>Token da API de Conversões</label>
            <input type="password" autoComplete="new-password" value={capiToken}
              onChange={(e) => setCapiToken(e.target.value)}
              placeholder={capiCfg ? '••••••••  (cole para substituir)' : 'Cole o token gerado no Gerenciador de Eventos'} />
          </div>
          <label className="linha-flex" style={{ marginBottom: 12, cursor: 'pointer', justifyContent: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={capiAtivo} onChange={(e) => setCapiAtivo(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--verde-escuro)' }} />
            <span style={{ fontSize: 13.5 }}>Envio ativo (dispara Purchase a cada venda aprovada)</span>
          </label>
          <button className="botao pequeno" disabled={ocupado}>Salvar Pixel</button>
        </form>

        {capiUltimoErro && (
          <div className="aviso" style={{ marginTop: 12 }}>
            Último erro do envio: {capiUltimoErro}
          </div>
        )}
      </div>
    </div>
  )
}
