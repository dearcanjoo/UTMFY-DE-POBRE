import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAuth() {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUsuario(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const entrar = (email, senha) => supabase.auth.signInWithPassword({ email, password: senha })
  const cadastrar = (email, senha) => supabase.auth.signUp({ email, password: senha })
  const sair = () => supabase.auth.signOut()

  return { usuario, carregando, entrar, cadastrar, sair }
}
