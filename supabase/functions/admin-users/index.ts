import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing authentication or server configuration' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()

  if (authError || !user) return jsonResponse({ error: 'Authentication required' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: adminRecord, error: adminError } = await adminClient
    .from('category_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) return jsonResponse({ error: 'Could not verify administrator permissions' }, 500)
  if (!adminRecord) return jsonResponse({ error: 'Administrator permission required' }, 403)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const action = body.action

  try {
    if (action === 'list') {
      const users = []
      for (let page = 1; page <= 100; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 })
        if (error) return jsonResponse({ error: error.message }, 400)
        users.push(...data.users)
        if (data.users.length < 100) break
      }

      const { data: admins, error: adminsError } = await adminClient
        .from('category_admins')
        .select('user_id')
      if (adminsError) return jsonResponse({ error: adminsError.message }, 400)
      const adminIds = new Set((admins || []).map((admin) => admin.user_id))

      return jsonResponse({
        users: users.map((account) => ({
          id: account.id,
          email: account.email || '',
          fullName: typeof account.user_metadata?.full_name === 'string' ? account.user_metadata.full_name : '',
          enabled: !account.banned_until || new Date(account.banned_until).getTime() <= Date.now(),
          isAdmin: adminIds.has(account.id),
          createdAt: account.created_at,
          lastSignInAt: account.last_sign_in_at,
        })),
      })
    }

    if (action === 'create') {
      const email = typeof body.email === 'string' ? body.email.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
      if (!email || !email.includes('@')) return jsonResponse({ error: 'A valid email is required' }, 400)
      if (password.length < 8) return jsonResponse({ error: 'Password must contain at least 8 characters' }, 400)

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ id: data.user.id })
    }

    if (action === 'update') {
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const email = typeof body.email === 'string' ? body.email.trim() : ''
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!userId || !email || !email.includes('@')) return jsonResponse({ error: 'A valid user and email are required' }, 400)
      if (password && password.length < 8) return jsonResponse({ error: 'Password must contain at least 8 characters' }, 400)

      const attributes: { email: string; user_metadata: { full_name: string }; password?: string } = {
        email,
        user_metadata: { full_name: fullName },
      }
      if (password) attributes.password = password

      const { error } = await adminClient.auth.admin.updateUserById(userId, attributes)
      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ success: true })
    }

    if (action === 'set-status') {
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const enabled = body.enabled
      if (!userId || typeof enabled !== 'boolean') return jsonResponse({ error: 'A user and status are required' }, 400)
      if (!enabled) {
        if (userId === user.id) return jsonResponse({ error: 'You cannot disable your own account' }, 400)
        const { data: protectedAdmin, error: protectedAdminError } = await adminClient
          .from('category_admins')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle()
        if (protectedAdminError) return jsonResponse({ error: protectedAdminError.message }, 400)
        if (protectedAdmin) return jsonResponse({ error: 'Administrator accounts cannot be disabled here' }, 400)
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: enabled ? 'none' : '876000h',
      })
      if (error) return jsonResponse({ error: error.message }, 400)
      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error('admin-users error:', error)
    return jsonResponse({ error: getMessage(error) }, 500)
  }
})
