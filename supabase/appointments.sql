-- Agenda de citas para profesionales (/agenda) y «Mis citas» para clientes de la plataforma (/mis-citas).
-- Ejecutar en Supabase > SQL Editor (idempotente).
-- Requiere antes: supabase/schema.sql (conversations) y supabase/user-notifications.sql.
--
-- Reglas:
--   * La agenda es gratuita para cualquier usuario con sesión (el plan premium da visibilidad e insignia, no la agenda).
--   * Un profesional puede agendar para clientes de la plataforma (solo personas que le hayan escrito por el chat) o para clientes
--     externos (nombre libre). Los clientes de la plataforma reciben una notificación y ven su cita en /mis-citas. Ven solo fecha,
--     lugar y estado: las notas y los datos de contacto son del profesional.
--   * No se pueden superponer dos citas «agendadas» del mismo profesional.
--   * Todas las escrituras pasan por funciones que validan los datos; la tabla solo la lee el profesional dueño de las citas.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  provider_name text,
  service_id bigint references public.services(id) on delete set null,
  service_title text,
  client_id uuid references auth.users(id) on delete set null,
  client_name text not null check (length(btrim(client_name)) between 1 and 120),
  client_phone text check (client_phone is null or length(client_phone) <= 30),
  client_email text check (client_email is null or length(client_email) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text check (mode is null or mode in ('local', 'home')),
  address text check (address is null or length(address) <= 200),
  notes text check (notes is null or length(notes) <= 1000),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_time_order check (ends_at > starts_at and ends_at - starts_at <= interval '24 hours'),
  constraint appointments_distinct_people check (client_id is null or client_id <> provider_id)
);

-- Cuándo se compartió la cita en el chat con el cliente (nulo = no compartida). Se borra si cambia el horario.
alter table public.appointments add column if not exists shared_at timestamptz;

create index if not exists appointments_provider_start_idx on public.appointments (provider_id, starts_at);
create index if not exists appointments_client_start_idx on public.appointments (client_id, starts_at) where client_id is not null;

alter table public.appointments enable row level security;

-- ¿La persona que consulta es premium? (publicación con plan vigente)
create or replace function public.is_premium_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.services s
    where s.provider_id = (select auth.uid())
      and s.premium_until is not null
      and s.premium_until > now()
  );
$$;

revoke all on function public.is_premium_user() from public, anon;
grant execute on function public.is_premium_user() to authenticated;

drop policy if exists "Premium providers read their appointments" on public.appointments;
drop policy if exists "Providers read their appointments" on public.appointments;
create policy "Providers read their appointments"
  on public.appointments for select
  to authenticated
  using (provider_id = (select auth.uid()));

-- Versiones anteriores dejaban a los clientes leer la tabla completa (incluye las notas privadas del profesional).
drop policy if exists "Clients read their appointments" on public.appointments;

revoke all on public.appointments from public, anon, authenticated;
grant select on public.appointments to authenticated;

-- Citas de la persona que llama como CLIENTE de la plataforma, solo con columnas seguras.
create or replace function public.list_my_client_appointments()
returns table (
  id uuid,
  provider_name text,
  service_id bigint,
  service_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  mode text,
  address text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.provider_name, a.service_id, a.service_title, a.starts_at, a.ends_at, a.mode, a.address, a.status
  from public.appointments a
  where a.client_id = (select auth.uid())
  order by a.starts_at;
$$;

revoke all on function public.list_my_client_appointments() from public, anon;
grant execute on function public.list_my_client_appointments() to authenticated;

-- Crea (p_id nulo) o actualiza una cita del profesional que llama. Devuelve su id.
create or replace function public.save_appointment(
  p_id uuid,
  p_service_id bigint,
  p_client_id uuid,
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_mode text,
  p_address text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  old_start timestamptz;
  old_end timestamptz;
  svc_title text;
  final_name text;
  clean_phone text := nullif(btrim(coalesce(p_client_phone, '')), '');
  clean_email text := nullif(btrim(coalesce(p_client_email, '')), '');
  clean_address text := nullif(btrim(coalesce(p_address, '')), '');
  clean_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  clash record;
  result_id uuid;
  provider_label text;
  when_text text;
begin
  if caller_id is null then
    raise exception 'Inicia sesión para usar la agenda.';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'La hora de término debe ser posterior a la de inicio.';
  end if;
  if p_ends_at - p_starts_at > interval '24 hours' then
    raise exception 'Una cita no puede durar más de 24 horas.';
  end if;
  if p_mode is not null and p_mode not in ('local', 'home') then
    raise exception 'Modalidad no válida.';
  end if;
  if clean_address is not null and length(clean_address) > 200 then
    raise exception 'La dirección puede tener hasta 200 caracteres.';
  end if;
  if clean_notes is not null and length(clean_notes) > 1000 then
    raise exception 'Las notas pueden tener hasta 1000 caracteres.';
  end if;
  if clean_phone is not null and length(clean_phone) > 30 then
    raise exception 'El teléfono no es válido.';
  end if;
  if clean_email is not null and (length(clean_email) > 120 or position('@' in clean_email) < 2) then
    raise exception 'El correo no es válido.';
  end if;

  -- Cliente de la plataforma: solo alguien que le haya escrito por el chat. Cliente externo: nombre obligatorio.
  if p_client_id is not null then
    if p_client_id = caller_id then
      raise exception 'No puedes agendarte una cita a ti mismo.';
    end if;
    select c.client_name into final_name
    from public.conversations c
    where c.provider_id = caller_id and c.client_id = p_client_id
    limit 1;
    if final_name is null then
      raise exception 'Solo puedes agendar con personas que te hayan escrito por el chat.';
    end if;
  else
    final_name := nullif(btrim(coalesce(p_client_name, '')), '');
    if final_name is null or length(final_name) > 120 then
      raise exception 'Escribe el nombre del cliente (hasta 120 caracteres).';
    end if;
  end if;

  if p_service_id is not null then
    select s.title into svc_title from public.services s where s.id = p_service_id and s.provider_id = caller_id;
    if svc_title is null then
      raise exception 'Solo puedes asociar la cita a una de tus publicaciones.';
    end if;
  end if;

  if p_id is not null then
    select a.starts_at, a.ends_at into old_start, old_end from public.appointments a where a.id = p_id and a.provider_id = caller_id;
    if not found then
      raise exception 'La cita no existe.';
    end if;
  end if;

  select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1))
  into provider_label from auth.users u where u.id = caller_id;

  -- Evita que dos solicitudes simultáneas agenden el mismo horario.
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  select a.client_name, a.starts_at into clash
  from public.appointments a
  where a.provider_id = caller_id
    and a.status = 'scheduled'
    and (p_id is null or a.id <> p_id)
    and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_starts_at, p_ends_at)
  limit 1;
  if found then
    raise exception 'Ya tienes una cita en ese horario (%, %).',
      clash.client_name, to_char(clash.starts_at at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI');
  end if;

  if p_id is null then
    insert into public.appointments
      (provider_id, provider_name, service_id, service_title, client_id, client_name, client_phone, client_email, starts_at, ends_at, mode, address, notes)
    values
      (caller_id, provider_label, p_service_id, svc_title, p_client_id, final_name, clean_phone, clean_email, p_starts_at, p_ends_at, p_mode, clean_address, clean_notes)
    returning id into result_id;
  else
    update public.appointments
    set provider_name = provider_label, service_id = p_service_id, service_title = svc_title, client_id = p_client_id,
        client_name = final_name, client_phone = clean_phone, client_email = clean_email, starts_at = p_starts_at,
        ends_at = p_ends_at, mode = p_mode, address = clean_address, notes = clean_notes, updated_at = now(),
        shared_at = case when old_start <> p_starts_at or old_end <> p_ends_at then null else shared_at end
    where id = p_id;
    result_id := p_id;
  end if;

  -- Aviso al cliente de la plataforma (nueva cita o cambio de horario).
  if p_client_id is not null and (p_id is null or old_start <> p_starts_at or old_end <> p_ends_at) then
    when_text := to_char(p_starts_at at time zone 'America/Santiago', 'DD-MM-YYYY "a las" HH24:MI');

    insert into public.user_notifications (user_id, type, title, body, link)
    values (p_client_id,
            case when p_id is null then 'appointment_created' else 'appointment_rescheduled' end,
            case when p_id is null then 'Tienes una nueva cita' else 'Tu cita cambió de horario' end,
            case when p_id is null
              then format('%s agendó una cita contigo para el %s.', coalesce(provider_label, 'Un profesional'), when_text)
              else format('%s movió tu cita al %s.', coalesce(provider_label, 'El profesional'), when_text) end,
            '/mis-citas');
  end if;

  return result_id;
end
$$;

revoke all on function public.save_appointment(uuid, bigint, uuid, text, text, text, timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.save_appointment(uuid, bigint, uuid, text, text, text, timestamptz, timestamptz, text, text, text) to authenticated;

-- Cambia el estado de una cita (agendada, completada, cancelada, no asistió).
create or replace function public.set_appointment_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  appt record;
  provider_label text;
begin
  if caller_id is null then
    raise exception 'Inicia sesión para usar la agenda.';
  end if;
  if p_status not in ('scheduled', 'completed', 'cancelled', 'no_show') then
    raise exception 'Estado no válido.';
  end if;

  select * into appt from public.appointments where id = p_id and provider_id = caller_id;
  if not found then
    raise exception 'La cita no existe.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

  if p_status = 'scheduled' and appt.status <> 'scheduled' and exists (
    select 1 from public.appointments a
    where a.provider_id = caller_id and a.status = 'scheduled' and a.id <> p_id
      and tstzrange(a.starts_at, a.ends_at) && tstzrange(appt.starts_at, appt.ends_at)
  ) then
    raise exception 'No se puede volver a agendar: ya tienes otra cita en ese horario.';
  end if;

  update public.appointments set status = p_status, updated_at = now() where id = p_id;

  if p_status = 'cancelled' and appt.status <> 'cancelled' and appt.client_id is not null then
    select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1))
    into provider_label from auth.users u where u.id = caller_id;

    insert into public.user_notifications (user_id, type, title, body, link)
    values (appt.client_id, 'appointment_cancelled', 'Tu cita fue cancelada',
            format('%s canceló la cita del %s.', coalesce(provider_label, 'El profesional'),
                   to_char(appt.starts_at at time zone 'America/Santiago', 'DD-MM-YYYY "a las" HH24:MI')),
            '/mis-citas');
  end if;
end
$$;

revoke all on function public.set_appointment_status(uuid, text) from public, anon;
grant execute on function public.set_appointment_status(uuid, text) to authenticated;

-- Marca que la cita ya se compartió en el chat (el mensaje lo envía la aplicación con el chat normal).
create or replace function public.mark_appointment_shared(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para usar la agenda.';
  end if;

  update public.appointments set shared_at = now() where id = p_id and provider_id = (select auth.uid());
  if not found then
    raise exception 'La cita no existe.';
  end if;
end
$$;

revoke all on function public.mark_appointment_shared(uuid) from public, anon;
grant execute on function public.mark_appointment_shared(uuid) to authenticated;

create or replace function public.delete_appointment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para usar la agenda.';
  end if;

  delete from public.appointments where id = p_id and provider_id = (select auth.uid());
  if not found then
    raise exception 'La cita no existe.';
  end if;
end
$$;

revoke all on function public.delete_appointment(uuid) from public, anon;
grant execute on function public.delete_appointment(uuid) to authenticated;

-- La agenda ya no es exclusiva de los planes premium: se quita de sus características (si una versión anterior la agregó).
update public.premium_plans
set features = array_remove(features, 'Agenda de citas para tus clientes, de la plataforma y externos')
where 'Agenda de citas para tus clientes, de la plataforma y externos' = any (features);

notify pgrst, 'reload schema';
