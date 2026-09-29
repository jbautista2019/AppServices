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

export async function getCategories() {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  return supabase
    .from('categories')
    .select('name, image_url')
    .order('name', { ascending: true })
}

export async function isCategoryAdmin() {
  if (!supabase) return { data: false, error: new Error('Supabase no está configurado.') }

  return supabase.rpc('is_category_admin')
}

export async function createCategory(name, imageUrl) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }

  return supabase.from('categories').insert({ name, image_url: imageUrl || null })
}

export async function updateCategory(currentName, name, imageUrl) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }

  return supabase.from('categories').update({ name, image_url: imageUrl || null }).eq('name', currentName)
}

export async function deleteCategory(name) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }

  return supabase.from('categories').delete().eq('name', name)
}

export async function manageUsers(payload) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  return supabase.functions.invoke('admin-users', { body: payload })
}
