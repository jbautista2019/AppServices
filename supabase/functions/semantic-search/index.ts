import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function de la búsqueda híbrida.
//   { action: 'search', query }      -> embedding de la consulta + public.search_services (público).
//   { action: 'embed', serviceId }   -> recalcula el embedding de un servicio (solo su dueño).
// Los embeddings (384 dimensiones) los genera el modelo gte-small incluido en el runtime de Supabase.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_QUERY_LENGTH = 200
const BACKFILL_BATCH = 8

// @ts-ignore: Supabase.ai lo provee el runtime de Edge Functions
const session = new Supabase.ai.Session('gte-small')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function embed(text: string): Promise<string> {
  const output = await session.run(text, { mean_pool: true, normalize: true })
  // pgvector acepta el vector como texto "[0.1,0.2,...]".
  return JSON.stringify(Array.from(output as ArrayLike<number>))
}

function serviceText(service: { title: string; category: string; description: string; location: string }) {
  return `${service.title}. ${service.category}. ${service.description}. Comuna: ${service.location}`.slice(0, 1500)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Missing server configuration' }, 500)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    if (body.action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : ''
      if (!query) return jsonResponse({ results: [] })

      // Autorreparación: calcula embeddings de servicios que aún no lo tienen (nuevos, editados o anteriores a este módulo).
      const { data: missing } = await admin
        .from('services')
        .select('id, title, category, description, location')
        .eq('is_active', true)
        .is('embedding', null)
        .limit(BACKFILL_BATCH)
      await Promise.all((missing ?? []).map(async (service) => {
        try {
          await admin.from('services').update({ embedding: await embed(serviceText(service)) }).eq('id', service.id)
        } catch (error) {
          console.error('embedding backfill failed for service', service.id, error)
        }
      }))

      const queryEmbedding = await embed(query)
      const { data, error } = await admin.rpc('search_services', {
        p_query: query,
        p_embedding: queryEmbedding,
        p_limit: 60,
      })
      if (error) return jsonResponse({ error: error.message }, 400)

      return jsonResponse({
        results: (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.service_id,
          score: row.score,
          text: row.text_match,
          semantic: row.semantic_match,
          similarity: row.semantic_similarity,
        })),
      })
    }

    if (body.action === 'embed') {
      const authorization = request.headers.get('Authorization')
      const serviceId = Number(body.serviceId)
      if (!authorization || !Number.isFinite(serviceId)) return jsonResponse({ error: 'Authentication and serviceId required' }, 400)

      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authorization } },
      })
      const { data: { user }, error: authError } = await userClient.auth.getUser()
      if (authError || !user) return jsonResponse({ error: 'Authentication required' }, 401)

      const { data: service, error: serviceError } = await admin
        .from('services')
        .select('id, provider_id, title, category, description, location')
        .eq('id', serviceId)
        .maybeSingle()
      if (serviceError) return jsonResponse({ error: serviceError.message }, 400)
      if (!service || service.provider_id !== user.id) return jsonResponse({ error: 'Not allowed' }, 403)

      const { error } = await admin.from('services').update({ embedding: await embed(serviceText(service)) }).eq('id', service.id)
      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('semantic-search error:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
