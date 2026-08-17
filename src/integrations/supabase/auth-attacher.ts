import { createMiddleware } from '@tanstack/react-start'
import { supabase, supabaseEnabled } from './client'

// Optional. Midnight Undeployed does not need Supabase; skip when env is unset.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    if (!supabaseEnabled()) {
      return next({ headers: {} })
    }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
