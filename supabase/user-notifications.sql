-- Notificaciones de la plataforma (moderación, resolución de reportes, etc.).
-- Ejecutar en Supabase > SQL Editor ANTES de supabase/service-reports.sql (idempotente).
--
-- Las notificaciones las crean funciones de la base de datos (security definer); las personas
-- solo pueden leer las suyas y marcarlas como leídas con mark_notifications_read().

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null check (length(title) <= 200),
  body text check (body is null or length(body) <= 1000),
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "Users read their own notifications" on public.user_notifications;
create policy "Users read their own notifications"
  on public.user_notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_notifications from public, anon, authenticated;
grant select on public.user_notifications to authenticated;

-- Marca como leídas las notificaciones indicadas (o todas las pendientes si no se pasa lista).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_notifications
  set read_at = now()
  where user_id = (select auth.uid())
    and read_at is null
    and (p_ids is null or id = any (p_ids));
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Realtime: la campana del encabezado se actualiza en cuanto llega una notificación.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end
$$;

notify pgrst, 'reload schema';
