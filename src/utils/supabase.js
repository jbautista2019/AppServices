import { createClient } from '@supabase/supabase-js'
import { trackedFetch } from './loading'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: trackedFetch } }) : null

// Columnas explícitas: nunca se pide services.embedding (vector de 384 números) al navegador.
const SERVICE_COLUMNS = 'id, title, provider_id, provider_name, category, location, rating, starting_price, image_url, description, offers_local, offers_home'
const SERVICE_DETAIL_COLUMNS = `${SERVICE_COLUMNS}, is_active, created_at`

export async function getPublishedServices() {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function getUserServices(userId) {
  if (!supabase || !userId) return { data: [], error: null }

  const columns = 'id, title, provider_name, category, location, rating, starting_price, image_url, description, is_active, created_at'
  const query = (select) => supabase.from('services').select(select).eq('provider_id', userId).order('created_at', { ascending: false })

  const { data, error } = await query(`${columns}, hidden_by_admin`)
  // Si aún no se ejecutó supabase/service-reports.sql, la columna no existe: se consulta sin ella.
  if (error?.code === '42703' || /hidden_by_admin/.test(error?.message || '')) return query(columns)

  return { data, error }
}

export async function getServiceById(serviceId) {
  if (!supabase || !serviceId) return { data: null, error: null }

  const { data, error } = await supabase
    .from('services')
    .select(SERVICE_DETAIL_COLUMNS)
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

export async function getOrCreateConversation(conversation) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  const { error: restoreError } = await supabase.rpc('restore_conversation_for_current_user', {
    p_service_id: conversation.service_id,
  })
  if (restoreError) return { data: null, error: restoreError }

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

export async function deleteConversation(conversationId) {
  if (!supabase || !conversationId) return { error: new Error('No se pudo identificar la conversación.') }

  const { data, error } = await supabase.rpc('hide_conversation_for_current_user', {
    p_conversation_id: conversationId,
  })
  if (error && (error.code === 'PGRST202' || error.message?.includes('schema cache'))) {
    return { data: null, error: new Error('Actualiza Supabase ejecutando el schema.sql y supabase/chat-upgrade.sql, y vuelve a intentar.') }
  }
  return { data, error: error || (data ? null : new Error('No tienes permiso para ocultar esta conversación.')) }
}

const MESSAGE_COLUMNS = 'id, conversation_id, sender_id, content, created_at, read_at'

export async function getConversationMessages(conversationId) {
  if (!supabase || !conversationId) return { data: [], error: new Error('No se pudo identificar la conversación.') }

  return supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
}

// Mensajes recientes de todas las conversaciones del usuario (RLS limita a las suyas); sirve para vista previa y no leídos.
export async function getInboxMessages(limit = 500) {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') }

  return supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function sendConversationMessage(conversationId, senderId, content) {
  if (!supabase || !conversationId || !senderId) return { data: null, error: new Error('Inicia sesión para enviar mensajes.') }

  return supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select(MESSAGE_COLUMNS)
    .single()
}

export async function getUnreadMessageNotifications(userId) {
  if (!supabase || !userId) return { data: [], error: null }

  return supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at, conversations!inner(service_title, client_id, provider_id, client_name, provider_name)')
    .neq('sender_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
}

export async function markConversationMessagesRead(conversationId, userId) {
  if (!supabase || !conversationId || !userId) return { error: new Error('No se pudo validar la conversación.') }

  return supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null)
}

export const SERVICE_IMAGE_BUCKET = 'service-images'
export const SERVICE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const SERVICE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateServiceImage(file) {
  if (!SERVICE_IMAGE_TYPES.includes(file.type)) return 'La imagen debe ser JPG, PNG o WebP.'
  if (file.size > SERVICE_IMAGE_MAX_BYTES) return 'La imagen no puede superar los 5 MB.'
  return ''
}

// Sube la imagen a Storage dentro de la carpeta del usuario y devuelve su URL pública.
export async function uploadServiceImage(file, userId) {
  if (!supabase || !userId) return { url: null, error: new Error('Inicia sesión para subir imágenes.') }

  const validationError = validateServiceImage(file)
  if (validationError) return { url: null, error: new Error(validationError) }

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(SERVICE_IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) {
    const missingBucket = /bucket not found/i.test(error.message || '')
    return { url: null, error: new Error(missingBucket ? 'Falta crear el almacenamiento de imágenes. Ejecuta supabase/storage-service-images.sql en Supabase.' : `No se pudo subir la imagen: ${error.message}`) }
  }

  return { url: supabase.storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl, error: null }
}

function friendlyReviewError(error) {
  if (!error) return null
  if (error.code === 'PGRST202' || /schema cache/i.test(error.message || '')) {
    return new Error('Falta habilitar las valoraciones en Supabase. Ejecuta supabase/reviews.sql.')
  }
  return new Error(error.message)
}

export async function requestServiceReview(conversationId) {
  if (!supabase || !conversationId) return { data: null, error: new Error('No se pudo identificar la conversación.') }

  const { data, error } = await supabase.rpc('request_review', { p_conversation_id: conversationId })
  return { data, error: friendlyReviewError(error) }
}

export async function getReviewRequest(requestId) {
  if (!supabase || !requestId) return { data: null, error: new Error('Solicitud no válida.') }

  return supabase
    .from('review_requests')
    .select('id, service_id, requester_id, recipient_id, service_title, requester_name, completed_at')
    .eq('id', requestId)
    .maybeSingle()
}

export async function submitServiceReview(requestId, rating, comment) {
  if (!supabase || !requestId) return { error: new Error('Solicitud no válida.') }

  const { error } = await supabase.rpc('submit_review', { p_request_id: requestId, p_rating: rating, p_comment: comment || null })
  return { error: friendlyReviewError(error) }
}

export async function getServiceReviews(serviceId) {
  if (!supabase || !serviceId) return { data: [], error: null }

  return supabase
    .from('service_reviews')
    .select('id, reviewer_name, rating, comment, created_at')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false })
    .limit(50)
}

// Promedio y distribución de las valoraciones recibidas en todos los servicios de un prestador.
export async function getProviderRatingSummary(userId) {
  if (!supabase || !userId) return { data: null, error: null }

  const { data: ownServices, error: servicesError } = await supabase
    .from('services')
    .select('id')
    .eq('provider_id', userId)
  if (servicesError) return { data: null, error: servicesError }
  if (!ownServices?.length) return { data: null, error: null }

  const { data, error } = await supabase
    .from('service_reviews')
    .select('rating')
    .in('service_id', ownServices.map((service) => service.id))

  if (error || !data?.length) return { data: null, error }

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  for (const review of data) {
    distribution[review.rating] += 1
    total += review.rating
  }
  return { data: { average: total / data.length, count: data.length, distribution }, error: null }
}

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam o publicidad engañosa' },
  { value: 'fraud', label: 'Posible estafa o fraude' },
  { value: 'inappropriate', label: 'Contenido inapropiado' },
  { value: 'misleading', label: 'Información falsa o engañosa' },
  { value: 'other', label: 'Otro motivo' },
]

export async function reportService(serviceId, reason, details) {
  if (!supabase || !serviceId) return { error: new Error('No se pudo identificar la publicación.') }

  const { error } = await supabase.rpc('submit_service_report', { p_service_id: serviceId, p_reason: reason, p_details: details || null })
  if (error && (error.code === 'PGRST202' || /schema cache/i.test(error.message || ''))) {
    return { error: new Error('Falta habilitar los reportes en Supabase. Ejecuta supabase/service-reports.sql.') }
  }
  return { error: error ? new Error(error.message) : null }
}

function friendlyReportAdminError(error) {
  if (!error) return null
  if (error.code === 'PGRST202' || /schema cache/i.test(error.message || '')) {
    return new Error('Falta habilitar la moderación en Supabase. Ejecuta supabase/service-reports.sql.')
  }
  return new Error(error.message)
}

export async function listServiceReports() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') }

  const { data, error } = await supabase.rpc('admin_list_service_reports')
  return { data: data || [], error: friendlyReportAdminError(error) }
}

// Reportes pendientes para la campana de notificaciones del administrador (la política de RLS ya limita la lectura a administradores).
export async function getPendingReportNotifications() {
  if (!supabase) return { data: [], error: null }

  return supabase
    .from('service_reports')
    .select('id, service_id, reason, created_at, services(title)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
}

export async function getUnreadPlatformNotifications(userId) {
  if (!supabase || !userId) return { data: [], error: null }

  return supabase
    .from('user_notifications')
    .select('id, type, title, body, link, created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
}

export async function markPlatformNotificationsRead(ids) {
  if (!supabase) return { error: null }

  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids?.length ? ids : null })
  return { error }
}

export const REPORTS_CHANGED_EVENT = 'service-reports-changed'

export async function setReportStatus(reportId, status) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }

  const { error } = await supabase.rpc('admin_set_report_status', { p_report_id: reportId, p_status: status })
  return { error: friendlyReportAdminError(error) }
}

export async function setServiceActive(serviceId, active) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }

  const { error } = await supabase.rpc('admin_set_service_active', { p_service_id: serviceId, p_active: active })
  return { error: friendlyReportAdminError(error) }
}

// Valoraciones recibidas en los servicios de un prestador, con quién las dejó, su comentario y el servicio valorado.
export async function getProviderReviews(userId) {
  if (!supabase || !userId) return { data: [], error: null }

  const { data: ownServices, error: servicesError } = await supabase
    .from('services')
    .select('id, title')
    .eq('provider_id', userId)
  if (servicesError) return { data: [], error: servicesError }
  if (!ownServices?.length) return { data: [], error: null }

  const titles = new Map(ownServices.map((service) => [service.id, service.title]))
  const { data, error } = await supabase
    .from('service_reviews')
    .select('id, service_id, reviewer_name, rating, comment, created_at')
    .in('service_id', ownServices.map((service) => service.id))
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }
  return { data: data.map((review) => ({ ...review, service_title: titles.get(review.service_id) || 'Servicio' })), error: null }
}

export const MIN_PASSWORD_LENGTH = 8

let communesCache = null

// Lista de comunas (se consulta una sola vez). Si falla devuelve [] y el campo funciona como texto libre.
export async function getCommunes() {
  if (communesCache) return communesCache
  if (!supabase) return []

  const { data, error } = await supabase.from('communes').select('name').order('name', { ascending: true })
  if (error || !data) return []
  communesCache = data.map((commune) => commune.name)
  return communesCache
}

// Cambia la contraseña del usuario actual. Si la cuenta ya tiene contraseña (correo), exige la actual.
export async function changePassword({ email, currentPassword, newPassword }) {
  if (!supabase) return { error: new Error('Supabase no está configurado.') }
  if (newPassword.length < MIN_PASSWORD_LENGTH) return { error: new Error(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`) }

  if (currentPassword !== null) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) return { error: new Error('La contraseña actual no es correcta.') }
    if (currentPassword === newPassword) return { error: new Error('La nueva contraseña debe ser distinta a la actual.') }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    if (error.code === 'same_password') return { error: new Error('La nueva contraseña debe ser distinta a la actual.') }
    if (error.code === 'weak_password') return { error: new Error('La contraseña es demasiado débil. Usa letras, números y símbolos.') }
    return { error: new Error('No se pudo cambiar la contraseña. Inténtalo nuevamente.') }
  }
  return { error: null }
}

// Llama a una Edge Function sin pasar por el indicador global de carga (son tareas de fondo o tienen su propio estado).
async function callEdgeFunction(name, body) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) return { data: null, error: new Error(data?.error || `Error ${response.status}`) }
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Búsqueda híbrida (texto + semántica). Devuelve [{ id, score, text, semantic, similarity }] ordenado por relevancia.
export async function semanticSearch(query) {
  const { data, error } = await callEdgeFunction('semantic-search', { action: 'search', query })
  return { data: data?.results ?? null, error }
}

// Recalcula el embedding de un servicio recién creado o editado (el trigger lo invalida al cambiar su texto).
export function refreshServiceEmbedding(serviceId) {
  if (!serviceId) return Promise.resolve()
  return callEdgeFunction('semantic-search', { action: 'embed', serviceId }).catch(() => {})
}
