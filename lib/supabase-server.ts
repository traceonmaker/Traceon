import { createClient } from '@supabase/supabase-js'

// Server-side only — ne jamais importer dans un composant client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
