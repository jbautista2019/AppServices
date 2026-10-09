-- Reportes de publicaciones. Ejecutar en Supabase > SQL Editor (idempotente), DESPUÉS de supabase/user-notifications.sql.
--
-- Cualquier usuario con sesión puede reportar una publicación ajena una sola vez.
-- Los reportes los crea submit_service_report(); no se insertan directamente.
-- Cada persona ve sus propios reportes y los administradores (category_admins) ven todos.

create table if not exists public.service_reports (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null references public.services(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'fraud', 'inappropriate', 'misleading', 'other')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint service_reports_service_reporter_key unique (service_id, reporter_id)
);

-- Conserva el reporte como evidencia aunque el dueño elimine la publicación:
-- guarda una copia de los datos y deja service_id en null cuando se borra el servicio.
alter table public.service_reports add column if not exists service_title text;
alter table public.service_reports add column if not exists provider_id uuid;
alter table public.service_reports add column if not exists provider_name text;
alter table public.service_reports alter column service_id drop not null;
alter table public.service_reports drop constraint if exists service_reports_service_id_fkey;
alter table public.service_reports
  add constraint service_reports_service_id_fkey
  foreign key (service_id) references public.services(id) on delete set null;

update public.service_reports r
set service_title = s.title, provider_id = s.provider_id, provider_name = s.provider_name
from public.services s
where s.id = r.service_id and r.service_title is null;

create index if not exists service_reports_status_created_idx
  on public.service_reports (status, created_at desc);

alter table public.service_reports enable row level security;

drop policy if exists "Reporters read their own reports" on public.service_reports;
create policy "Reporters read their own reports"
  on public.service_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_category_admin()));

revoke all on public.service_reports from public, anon, authenticated;
grant select on public.service_reports to authenticated;

create or replace function public.submit_service_report(p_service_id bigint, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  svc record;
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  if caller_id is null then
    raise exception 'Inicia sesión para reportar una publicación.';
  end if;

  if p_reason is null or p_reason not in ('spam', 'fraud', 'inappropriate', 'misleading', 'other') then
    raise exception 'Selecciona un motivo válido.';
  end if;

  if clean_details is not null and length(clean_details) > 1000 then
    raise exception 'El detalle no puede superar los 1000 caracteres.';
  end if;

  select * into svc from public.services where id = p_service_id and is_active = true;
  if not found then
    raise exception 'Esta publicación no está disponible.';
  end if;

  if svc.provider_id = caller_id then
    raise exception 'No puedes reportar tu propia publicación.';
  end if;

  begin
    insert into public.service_reports (service_id, reporter_id, reason, details, service_title, provider_id, provider_name)
    values (p_service_id, caller_id, p_reason, clean_details, svc.title, svc.provider_id, svc.provider_name);
  exception when unique_violation then
    raise exception 'Ya reportaste esta publicación. Revisaremos tu reporte.';
  end;
end
$$;

revoke all on function public.submit_service_report(bigint, text, text) from public;
grant execute on function public.submit_service_report(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Moderación (solo administradores de category_admins)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_service_reports();
create or replace function public.admin_list_service_reports()
returns table (
  id uuid,
  service_id bigint,
  service_title text,
  service_active boolean,
  service_deleted boolean,
  provider_name text,
  reporter_name text,
  reporter_email text,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  report_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_category_admin()) then
    raise exception 'No tienes permiso para ver los reportes.';
  end if;

  return query
  select
    r.id,
    r.service_id,
    coalesce(s.title, r.service_title, 'Publicación eliminada'),
    coalesce(s.is_active, false),
    (r.service_id is null),
    coalesce(s.provider_name, r.provider_name, '—'),
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
    u.email::text,
    r.reason,
    r.details,
    r.status,
    r.created_at,
    (select count(*) from public.service_reports x where x.service_id is not distinct from r.service_id)
  from public.service_reports r
  left join public.services s on s.id = r.service_id
  left join auth.users u on u.id = r.reporter_id
  order by (r.status = 'pending') desc, r.created_at desc;
end
$$;

revoke all on function public.admin_list_service_reports() from public;
grant execute on function public.admin_list_service_reports() to authenticated;

create or replace function public.admin_set_report_status(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare
  rep record;
begin
  if not (select public.is_category_admin()) then
    raise exception 'No tienes permiso para moderar reportes.';
  end if;

  if p_status not in ('pending', 'reviewed', 'dismissed') then
    raise exception 'Estado no válido.';
  end if;

  select id, reporter_id, service_title, status into rep from public.service_reports where id = p_report_id;
  if not found then
    raise exception 'El reporte no existe.';
  end if;

  update public.service_reports set status = p_status where id = p_report_id;

  -- Avisa a quien reportó cuando su reporte se resuelve (no al reabrirlo).
  if p_status in ('reviewed', 'dismissed') and rep.status is distinct from p_status then
    insert into public.user_notifications (user_id, type, title, body, link)
    values (
      rep.reporter_id,
      'report_resolved',
      case when p_status = 'reviewed' then 'Revisamos tu reporte' else 'Cerramos tu reporte' end,
      case when p_status = 'reviewed'
        then format('Gracias por avisarnos. Revisamos tu reporte sobre «%s» y tomamos las medidas necesarias.', coalesce(rep.service_title, 'la publicación'))
        else format('Revisamos tu reporte sobre «%s» y no encontramos motivos para actuar. Gracias por ayudarnos a cuidar la comunidad.', coalesce(rep.service_title, 'la publicación'))
      end,
      null
    );
  end if;
end
$;

revoke all on function public.admin_set_report_status(uuid, text) from public;
grant execute on function public.admin_set_report_status(uuid, text) to authenticated;

-- Oculta (o vuelve a publicar) una publicación reportada.
create or replace function public.admin_set_service_active(p_service_id bigint, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare
  svc record;
begin
  if not (select public.is_category_admin()) then
    raise exception 'No tienes permiso para moderar publicaciones.';
  end if;

  select id, provider_id, title, is_active, hidden_by_admin into svc from public.services where id = p_service_id;
  if not found then
    raise exception 'La publicación no existe.';
  end if;

  update public.services set is_active = p_active, hidden_by_admin = not p_active where id = p_service_id;

  -- Avisa al dueño solo si el estado de moderación cambió.
  if svc.provider_id is not null and svc.hidden_by_admin is distinct from (not p_active) then
    insert into public.user_notifications (user_id, type, title, body, link)
    values (
      svc.provider_id,
      'service_moderation',
      case when p_active then 'Tu publicación volvió a estar visible' else 'Ocultamos tu publicación' end,
      case when p_active
        then format('Revisamos «%s» y volvió a mostrarse en la plataforma.', svc.title)
        else format('«%s» fue ocultada tras revisar reportes de la comunidad. Mientras esté oculta no puedes reactivarla.', svc.title)
      end,
      '/mis-servicios'
    );
  end if;
end
$;

revoke all on function public.admin_set_service_active(bigint, boolean) from public;
grant execute on function public.admin_set_service_active(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Ocultar por moderación: distinto de "pausar". El dueño no puede reactivar una publicación
-- que un administrador ocultó, ni modificar esta marca.
-- ---------------------------------------------------------------------------

alter table public.services add column if not exists hidden_by_admin boolean not null default false;

create or replace function public.protect_service_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_category_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.hidden_by_admin := false;
  else
    new.hidden_by_admin := old.hidden_by_admin;
    if old.hidden_by_admin then
      new.is_active := false;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists protect_service_moderation on public.services;
create trigger protect_service_moderation
  before insert or update on public.services
  for each row execute function public.protect_service_moderation();

notify pgrst, 'reload schema';

-- Realtime: avisa al administrador en cuanto llega un reporte nuevo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_reports'
  ) then
    alter publication supabase_realtime add table public.service_reports;
  end if;
end
$$;
