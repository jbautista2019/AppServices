import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function getPublishedServices() {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('services')
    .select('id, title, provider_id, provider_name, category, location, rating, starting_price, image_url, description')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function getUserServices(userId) {
  if (!supabase || !userId) return { data: [], error: null }

  const { data, error } = await supabase
    .from('services')
    .select('id, title, provider_name, category, location, rating, starting_price, image_url, description, is_active, created_at')
    .eq('provider_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function getServiceById(serviceId) {
  if (!supabase || !serviceId) return { data: null, error: null }

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()

  return { data, error }
}

export async function createService(service) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  return supabase
    .from('services')
    .insert(service)
    .select('id')
    .single()
}

export async function updateService(serviceId, userId, updates) {
  if (!supabase || !serviceId || !userId) return { data: null, error: new Error('No se pudo validar el propietario del servicio.') }

  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', serviceId)
    .eq('provider_id', userId)
    .select('id')
    .maybeSingle()

  return { data, error: error || (!data ? new Error('No se encontró el servicio o no tienes permiso para modificarlo.') : null) }
}

export async function deleteService(serviceId, userId) {
  if (!supabase || !serviceId || !userId) return { data: null, error: new Error('No se pudo validar el propietario del servicio.') }

  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('provider_id', userId)
    .select('id')
    .maybeSingle()

  return { data, error: error || (!data ? new Error('No se encontró el servicio o no tienes permiso para eliminarlo.') : null) }
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

export async function getOrCreateConversation(conversation) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('*')
    .eq('service_id', conversation.service_id)
    .eq('client_id', conversation.client_id)
    .maybeSingle()

  if (lookupError) return { data: null, error: lookupError }
  if (existing) return { data: existing, error: null }

  const { data, error } = await supabase
    .from('conversations')
    .insert(conversation)
    .select('*')
    .single()

  if (error?.code !== '23505') return { data, error }

  return supabase
    .from('conversations')
    .select('*')
    .eq('service_id', conversation.service_id)
    .eq('client_id', conversation.client_id)
    .single()
}

export async function getUserConversations() {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  return supabase
    .from('conversations')
    .select('id, service_id, client_id, provider_id, service_title, provider_name, client_name, created_at')
    .order('created_at', { ascending: false })
}

export async function getConversationMessages(conversationId) {
  if (!supabase || !conversationId) return { data: [], error: new Error('No se pudo identificar la conversación.') }

  return supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
}

export async function sendConversationMessage(conversationId, senderId, content) {
  if (!supabase || !conversationId || !senderId) return { error: new Error('Inicia sesión para enviar mensajes.') }

  return supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content,
  })
}
