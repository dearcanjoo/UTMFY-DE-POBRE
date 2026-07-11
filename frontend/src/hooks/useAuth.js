import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAuth() {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, session) => {
      setUsuario(session?.user ?? null)
      // Quando o usuário abre o link de "esqueci a senha", o Supabase dispara este evento.
      // Aí mostramos a tela para ele DEFINIR uma nova senha, em vez de entrar direto.
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const entrar = (email, senha) =>
    supabase.auth.signInWithPassword({ email: email.trim(), password: senha })

  // dados = { nome, data_nascimento, faturamento_faixa } → vão para o metadata
  // e o trigger no banco cria a linha em public.perfis automaticamente.
  const cadastrar = (email, senha, dados = {}) =>
    supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: dados },
    })

  const recuperarSenha = (email) =>
    supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}`,
    })

  const reenviarConfirmacao = (email) =>
    supabase.auth.resend({ type: 'signup', email: email.trim() })

  const atualizarSenha = (novaSenha) =>
    supabase.auth.updateUser({ password: novaSenha })

  const concluirRecuperacao = () => setRecuperandoSenha(false)

  const sair = async () => {
    setRecuperandoSenha(false)
    return supabase.auth.signOut()
  }

  return {
    usuario, carregando, recuperandoSenha,
    entrar, cadastrar, recuperarSenha, reenviarConfirmacao,
    atualizarSenha, concluirRecuperacao, sair,
  }
}
