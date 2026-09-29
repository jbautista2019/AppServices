import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function getPublishedServices() {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('services')
    .select('id, title, provider_name, category, location, rating, starting_price, image_url, description')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return { data, error }
}
