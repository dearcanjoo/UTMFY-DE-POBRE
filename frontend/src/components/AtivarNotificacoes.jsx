import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Chave pública VAPID (pode ser exposta no frontend; a privada fica só no servidor).
const VAPID_PUBLIC = 'BE4JU8shHBDIOABsrTrX93FXkpkXXQ_mxvyL8Y_DRMnlKxh9scbHudCgiBzGyiQOv_DsmLia5TWH_Io1b-PNUek'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const suportado = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

// iPhone/iPad só entrega push quando o site foi instalado na Tela de Início.
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instaladoNaTela = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

export default function AtivarNotificacoes({ usuario }) {
  const [estado, setEstado] = useState('carregando') // carregando | ativo | inativo | sem-suporte | precisa-instalar
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!suportado()) {
      setEstado(ehIOS() && !instaladoNaTela() ? 'precisa-instalar' : 'sem-suporte')
      return
    }
    if (ehIOS() && !instaladoNaTela()) {
      setEstado('precisa-instalar')
      return
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'ativo' : 'inativo'))
      .catch(() => setEstado('inativo'))
  }, [])

  async function ativar() {
    setErro('')
    setOcupado(true)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setErro('Permissão de notificação negada. Ative nas configurações do navegador para receber os relatórios.')
        setOcupado(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          usuario_id: usuario.id,
          endpoint: sub.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 300),
        },
        { onConflict: 'usuario_id,endpoint' },
      )
      if (error) throw error
      setEstado('ativo')
    } catch (e) {
      setErro('Não consegui ativar agora. Tente novamente. ' + (e?.message || ''))
    } finally {
      setOcupado(false)
    }
  }

  async function desativar() {
    setErro('')
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setEstado('inativo')
    } catch (e) {
      setErro('Não consegui desativar agora. ' + (e?.message || ''))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="card secao">
      <div className="subtitulo">Notificações</div>
      <p className="texto-suave" style={{ marginBottom: 12 }}>
        Receba no celular o resumo de lucro do dia (12h e 22h), o fechamento do dia anterior (6h) e alertas
        das suas contas de anúncio (saldo baixo, cobrança recusada ou conta bloqueada).
      </p>

      {estado === 'carregando' && <p className="texto-suave">Verificando…</p>}

      {estado === 'precisa-instalar' && (
        <p className="texto-suave">
          No iPhone, as notificações só funcionam com o app instalado. Abra este site no <strong>Safari</strong>,
          toque em <strong>Compartilhar → Adicionar à Tela de Início</strong> e depois volte aqui para ativar.
        </p>
      )}

      {estado === 'sem-suporte' && (
        <p className="texto-suave">Este navegador não suporta notificações push.</p>
      )}

      {estado === 'inativo' && (
        <button className="botao" onClick={ativar} disabled={ocupado}>
          {ocupado ? 'Ativando…' : 'Ativar notificações'}
        </button>
      )}

      {estado === 'ativo' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: 'var(--verde, #16a34a)' }}>✓ Notificações ativadas neste aparelho</span>
          <button className="botao secundario" onClick={desativar} disabled={ocupado}>
            {ocupado ? 'Desativando…' : 'Desativar'}
          </button>
        </div>
      )}

      {erro && <p style={{ fontSize: 13, color: 'var(--vermelho, #dc2626)', marginTop: 10 }}>{erro}</p>}
    </div>
  )
}
