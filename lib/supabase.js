import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export function createSupabaseClient(accessToken) {
  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
}