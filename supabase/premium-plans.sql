-- Planes premium para promocionar publicaciones. Ejecutar en Supabase > SQL Editor (idempotente).
-- Requiere antes: supabase/user-notifications.sql y supabase/service-reports.sql (usa category_admins y el trigger de moderación).
--
-- Flujo:
--   1. El profesional elige un plan y una de sus publicaciones activas en /planes → request_promotion() crea una solicitud «pending»
--      y avisa a los administradores.
--   2. Un administrador confirma el pago (fuera de la plataforma, por ahora) y la activa en /admin/promociones →
--      admin_set_promotion_status() la deja «active» y fija services.premium_until = ahora + días del plan.
--   3. Mientras premium_until sea futuro, la publicación sale primero en «Profesionales más buscados» de la portada y lleva la insignia Premium.
--      Al vencer no hace falta ningún proceso: la fecha simplemente queda en el pasado.
-- Los precios de abajo son valores de ejemplo: cámbialos editando la tabla premium_plans.

-- ---------------------------------------------------------------------------
-- Planes
-- ---------------------------------------------------------------------------

create table if not exists public.premium_plans (
  id text primary key,
  name text not null,
  description text,
  days integer not null check (days > 0),
  price_clp integer not null check (price_clp >= 0),
  features text[] not null default '{}',
  highlighted boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

alter table public.premium_plans enable row level security;

drop policy if exists "Premium plans are public" on public.premium_plans;
create policy "Premium plans are public"
  on public.premium_plans for select
  to anon, authenticated
  using (is_active = true);

revoke all on public.premium_plans from public, anon, authenticated;
grant select on public.premium_plans to anon, authenticated;

insert into public.premium_plans (id, name, description, days, price_clp, features, highlighted, sort_order)
values
  ('premium-30', 'Premium 30 días', 'Para probar el impacto de aparecer en la portada.', 30, 9990,
   array['Tu publicación en «Profesionales más buscados» de la portada', 'Insignia Premium en tu publicación', 'Aparece antes que las publicaciones sin plan', '30 días de visibilidad'], false, 1),
  ('premium-90', 'Premium 90 días', 'La opción más conveniente: tres meses de visibilidad.', 90, 24990,
   array['Tu publicación en «Profesionales más buscados» de la portada', 'Insignia Premium en tu publicación', 'Aparece antes que las publicaciones sin plan', '90 días de visibilidad', 'Ahorras más de un 15% frente al plan mensual'], true, 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Marca premium en las publicaciones (la fija solo el administrador)
-- ---------------------------------------------------------------------------

alter table public.services add column if not exists premium_until timestamptz;

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
    new.premium_until := null;
  else
    new.hidden_by_admin := old.hidden_by_admin;
    new.premium_until := old.premium_until;
    if old.hidden_by_admin then
      new.is_active := false;
    end if;
  end if;

  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Solicitudes de promoción
-- ---------------------------------------------------------------------------

create table if not exists public.service_promotions (
  id uuid primary key default gen_random_uuid(),
  service_id bigint references public.services(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.premium_plans(id),
  service_title text not null,
  plan_name text not null,
  price_clp integer not null,
  days integer not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz
);

create index if not exists service_promotions_user_idx on public.service_promotions (user_id, requested_at desc);
create index if not exists service_promotions_status_idx on public.service_promotions (status, requested_at desc);

alter table public.service_promotions enable row level security;

drop policy if exists "Owners read their promotions" on public.service_promotions;
create policy "Owners read their promotions"
  on public.service_promotions for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.service_promotions from public, anon, authenticated;
grant select on public.service_promotions to authenticated;

-- El profesional solicita un plan para una de sus publicaciones activas.
create or replace function public.request_promotion(p_service_id bigint, p_plan_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  svc record;
  pl record;
  new_id uuid;
  caller_name text;
begin
  if caller_id is null then
    raise exception 'Inicia sesión para solicitar un plan.';
  end if;

  select * into pl from public.premium_plans where id = p_plan_id and is_active = true;
  if not found then
    raise exception 'El plan elegido no está disponible.';
  end if;

  select id, provider_id, title, is_active into svc from public.services where id = p_service_id;
  if not found or svc.provider_id is distinct from caller_id then
    raise exception 'Solo puedes promocionar tus propias publicaciones.';
  end if;
  if not svc.is_active then
    raise exception 'La publicación debe estar activa para promocionarla.';
  end if;

  if exists (
    select 1 from public.service_promotions
    where service_id = p_service_id and status = 'pending'
  ) then
    raise exception 'Esta publicación ya tiene una solicitud pendiente.';
  end if;

  if exists (select 1 from public.services where id = p_service_id and premium_until is not null and premium_until > now()) then
    raise exception 'Esta publicación ya es premium. Podrás renovar el plan cuando venza.';
  end if;

  insert into public.service_promotions (service_id, user_id, plan_id, service_title, plan_name, price_clp, days)
  values (p_service_id, caller_id, pl.id, svc.title, pl.name, pl.price_clp, pl.days)
  returning id into new_id;

  select coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1))
  into caller_name from auth.users where id = caller_id;

  -- Avisa a cada administrador.
  insert into public.user_notifications (user_id, type, title, body, link)
  select a.user_id, 'promotion_request', 'Nueva solicitud de plan premium',
         format('%s pidió «%s» para «%s».', coalesce(caller_name, 'Un profesional'), pl.name, svc.title),
         '/admin/promociones'
  from public.category_admins a;

  return new_id;
end
$$;

revoke all on function public.request_promotion(bigint, text) from public, anon;
grant execute on function public.request_promotion(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Administración de promociones (solo category_admins)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_promotions();
create or replace function public.admin_list_promotions()
returns table (
  id uuid,
  service_id bigint,
  service_title text,
  service_exists boolean,
  provider_name text,
  user_email text,
  plan_name text,
  price_clp integer,
  days integer,
  status text,
  requested_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_category_admin()) then
    raise exception 'No tienes permiso para ver las promociones.';
  end if;

  return query
  select
    p.id,
    p.service_id,
    coalesce(s.title, p.service_title),
    (s.id is not null),
    coalesce(s.provider_name, split_part(u.email, '@', 1)),
    u.email::text,
    p.plan_name,
    p.price_clp,
    p.days,
    p.status,
    p.requested_at,
    p.starts_at,
    p.ends_at
  from public.service_promotions p
  left join public.services s on s.id = p.service_id
  left join auth.users u on u.id = p.user_id
  order by (p.status = 'pending') desc, p.requested_at desc
  limit 500;
end
$$;

revoke all on function public.admin_list_promotions() from public, anon;
grant execute on function public.admin_list_promotions() to authenticated;

-- Activa, rechaza o cancela una promoción. Al activar fija premium_until; al cancelar la quita.
create or replace function public.admin_set_promotion_status(p_promotion_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo record;
  new_end timestamptz;
begin
  if not (select public.is_category_admin()) then
    raise exception 'No tienes permiso para gestionar promociones.';
  end if;

  if p_status not in ('active', 'rejected', 'cancelled') then
    raise exception 'Estado no válido.';
  end if;

  select * into promo from public.service_promotions where id = p_promotion_id;
  if not found then
    raise exception 'La promoción no existe.';
  end if;

  if p_status = 'active' then
    if promo.status <> 'pending' then
      raise exception 'Solo se pueden activar solicitudes pendientes.';
    end if;
    if promo.service_id is null then
      raise exception 'La publicación ya no existe.';
    end if;

    -- Si ya era premium, se suma el tiempo a continuación del vigente.
    select greatest(coalesce(premium_until, now()), now()) + make_interval(days => promo.days)
    into new_end from public.services where id = promo.service_id;

    update public.services set premium_until = new_end where id = promo.service_id;
    update public.service_promotions set status = 'active', starts_at = now(), ends_at = new_end where id = promo.id;

    insert into public.user_notifications (user_id, type, title, body, link)
    values (promo.user_id, 'promotion_active', 'Tu publicación ya es premium',
            format('Activamos «%s» para «%s». Estará destacada en la portada hasta el %s.', promo.plan_name, promo.service_title, to_char(new_end at time zone 'America/Santiago', 'DD-MM-YYYY')),
            '/mis-servicios');

  elsif p_status = 'rejected' then
    if promo.status <> 'pending' then
      raise exception 'Solo se pueden rechazar solicitudes pendientes.';
    end if;
    update public.service_promotions set status = 'rejected' where id = promo.id;

    insert into public.user_notifications (user_id, type, title, body, link)
    values (promo.user_id, 'promotion_rejected', 'No pudimos activar tu plan',
            format('Tu solicitud de «%s» para «%s» no fue aprobada. Puedes volver a solicitarla desde Planes.', promo.plan_name, promo.service_title),
            '/planes');

  else -- cancelled
    if promo.status <> 'active' then
      raise exception 'Solo se pueden cancelar promociones activas.';
    end if;
    update public.service_promotions set status = 'cancelled' where id = promo.id;
    if promo.service_id is not null then
      update public.services set premium_until = null where id = promo.service_id;
    end if;

    insert into public.user_notifications (user_id, type, title, body, link)
    values (promo.user_id, 'promotion_cancelled', 'Tu plan premium terminó',
            format('«%s» dejó de estar destacada en la portada.', promo.service_title),
            '/planes');
  end if;
end
$$;

revoke all on function public.admin_set_promotion_status(uuid, text) from public, anon;
grant execute on function public.admin_set_promotion_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
