-- Mejora de mensajería (autocontenido e idempotente). Ejecutar en Supabase > SQL Editor.
--
-- "Eliminar conversación" borra el historial SOLO para quien la elimina:
--   * conversation_hidden guarda, por usuario, desde cuándo se limpió el historial (hidden_at).
--   * Esa persona no vuelve a ver mensajes anteriores a hidden_at, aunque la conversación reaparezca.
--   * La otra persona sigue viendo todo con normalidad.
--   * La conversación reaparece para quien la eliminó si llega un mensaje nuevo o si vuelve a
--     pulsar "Contactar"; en ambos casos solo verá mensajes posteriores a la eliminación.

create table if not exists public.conversation_hidden (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_hidden
  add column if not exists restored boolean not null default false;

alter table public.conversation_hidden enable row level security;
revoke all on public.conversation_hidden from public, anon, authenticated;

-- La versión anterior eliminaba la fila al llegar un mensaje, lo que revelaba el historial borrado.
drop trigger if exists messages_unhide_conversation on public.messages;
drop function if exists public.unhide_conversation_on_message();

-- ¿La conversación está oculta para mí? (no si la restauré o si hay mensajes posteriores a la eliminación)
create or replace function public.is_conversation_hidden(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_hidden h
    where h.conversation_id = p_conversation_id
      and h.user_id = (select auth.uid())
      and not h.restored
      and not exists (
        select 1
        from public.messages m
        where m.conversation_id = h.conversation_id
          and m.created_at > h.hidden_at
      )
  );
$$;

revoke all on function public.is_conversation_hidden(uuid) from public;
grant execute on function public.is_conversation_hidden(uuid) to authenticated;

-- ¿Puedo ver un mensaje? Solo si es posterior a la última eliminación mía.
create or replace function public.is_message_visible(p_conversation_id uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.conversation_hidden h
    where h.conversation_id = p_conversation_id
      and h.user_id = (select auth.uid())
      and h.hidden_at >= p_created_at
  );
$$;

revoke all on function public.is_message_visible(uuid, timestamptz) from public;
grant execute on function public.is_message_visible(uuid, timestamptz) to authenticated;

create or replace function public.hide_conversation_for_current_user(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if caller_id is null or not exists (
    select 1
    from public.conversations
    where id = p_conversation_id
      and (client_id = caller_id or provider_id = caller_id)
  ) then
    return false;
  end if;

  insert into public.conversation_hidden (conversation_id, user_id, hidden_at, restored)
  values (p_conversation_id, caller_id, clock_timestamp(), false)
  on conflict (conversation_id, user_id)
  do update set hidden_at = excluded.hidden_at, restored = false;

  return true;
end
$$;

revoke all on function public.hide_conversation_for_current_user(uuid) from public;
grant execute on function public.hide_conversation_for_current_user(uuid) to authenticated;

-- Al volver a contactar un servicio: la conversación reaparece, pero el historial borrado no.
create or replace function public.restore_conversation_for_current_user(p_service_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_uuid uuid;
begin
  select id into conversation_uuid
  from public.conversations
  where service_id = p_service_id
    and client_id = (select auth.uid());

  if conversation_uuid is null then
    return false;
  end if;

  update public.conversation_hidden
  set restored = true
  where conversation_id = conversation_uuid
    and user_id = (select auth.uid());

  return true;
end
$$;

revoke all on function public.restore_conversation_for_current_user(bigint) from public;
grant execute on function public.restore_conversation_for_current_user(bigint) to authenticated;

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations"
  on public.conversations for select
  to authenticated
  using (
    (auth.uid() = client_id or auth.uid() = provider_id)
    and not public.is_conversation_hidden(id)
  );

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations
      where id = conversation_id
        and (auth.uid() = client_id or auth.uid() = provider_id)
    )
    and public.is_message_visible(conversation_id, created_at)
  );

-- Realtime también para conversaciones nuevas.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end
$$;

notify pgrst, 'reload schema';
