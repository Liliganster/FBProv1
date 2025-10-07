import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const SUPABASE_CONFIG_ERROR = 'Missing Supabase environment variables. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

let internalClient: SupabaseClient<any, any, any> | null = null

if (isSupabaseConfigured && supabaseUrl && supabaseAnonKey) {
  internalClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      // Habilitar el procesamiento automático del callback OAuth en la URL.
      // Con detectSessionInUrl en false, el flujo PKCE/implicit no guarda la sesión
      // tras el retorno a /auth/callback y provoca un bucle de login en producción.
      detectSessionInUrl: true
    }
  })
} else if (typeof window !== 'undefined') {
  console.warn(SUPABASE_CONFIG_ERROR)
}

const getClientOrThrow = (): SupabaseClient<any, any, any> => {
  if (!internalClient) {
    throw new Error(SUPABASE_CONFIG_ERROR)
  }
  return internalClient
}

const supabaseProxy = new Proxy({} as SupabaseClient<any, any, any>, {
  get(_target, property, _receiver) {
    const client = getClientOrThrow() as unknown as Record<string | symbol, unknown>
    const value = client[property as keyof typeof client]
    if (typeof value === 'function') {
      return (value as Function).bind(client)
    }
    return value
  },
  set(_target, property, value) {
    const client = getClientOrThrow() as unknown as Record<string | symbol, unknown>
    client[property as keyof typeof client] = value
    return true
  }
}) as SupabaseClient<any, any, any>

export const supabase = supabaseProxy

export const getSupabaseClient = (): SupabaseClient<any, any, any> | null => internalClient
export const requireSupabaseClient = getClientOrThrow
