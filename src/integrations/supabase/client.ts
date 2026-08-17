import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function readSupabaseEnv(): { url: string; key: string } | null {
  const url = import.meta.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return null;
  return { url, key };
}

/** Midnight Undeployed does not need Supabase. Returns false when env is unset. */
export function supabaseEnabled(): boolean {
  return readSupabaseEnv() !== null;
}

function createSupabaseClient() {
  const env = readSupabaseEnv();
  if (!env) return null;

  return createClient<Database>(env.url, env.key, {
    global: {
      fetch: createSupabaseFetch(env.key),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseClient>>;

let _supabase: SupabaseClient | null | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    if (_supabase === undefined) _supabase = createSupabaseClient();
    if (!_supabase) {
      throw new Error('Supabase is not configured. The Midnight Undeployed path does not need it.');
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
