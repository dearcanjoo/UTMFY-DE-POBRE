import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// Carrega o perfil do usuário logado (nome + nome_usuario).
// Usado para decidir se precisamos obrigar a definição do nome de usuário.
export function usePerfil(usuario) {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!usuario) { setPerfil(null); setCarregando(false); return }
    setCarregando(true)
    const { data } = await supabase
      .from('perfis')
      .select('nome, nome_usuario')
      .eq('usuario_id', usuario.id)
      .maybeSingle()
    setPerfil(data ?? null)
    setCarregando(false)
  }, [usuario?.id])

  useEffect(() => { carregar() }, [carregar])

  return { perfil, carregando, recarregar: carregar }
}
