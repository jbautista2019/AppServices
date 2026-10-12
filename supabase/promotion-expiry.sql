-- Vencimiento automático de los planes premium. Ejecutar en Supabase > SQL Editor (idempotente).
-- Requiere antes: supabase/premium-plans.sql y supabase/user-notifications.sql.
--
-- Qué hace:
--   * La publicación deja de ser premium sola al llegar premium_until (eso no necesita ningún proceso). Este script se ocupa de lo demás:
--   * Marca como «expired» (Vencida) las promociones activas cuya fecha de término ya pasó, y avisa al dueño en su campana.
--     Si el plan se renovó antes de vencer (la publicación sigue premium), la promoción anterior se cierra sin avisar.
--   * Avisa 3 días antes del término («vence pronto») para que el profesional pueda renovar. Se avisa una sola vez por promoción.
--   * Se ejecuta cada hora con pg_cron. Además el panel /admin/promociones lo ejecuta al abrirse, por si pg_cron no está habilitado.

-- Nuevo estado «expired» y marca del recordatorio enviado.
alter table public.service_promotions add column if not exists reminder_sent_at timestamptz;

do $$
declare
  existing record;
begin
  for existing in
    select conname
    from pg_constraint
    where conrelid = 'public.service_promotions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.service_promotions drop constraint %I', existing.conname);
  end loop;

  alter table public.service_promotions
    add constraint service_promotions_status_check
    check (status in ('pending', 'active', 'rejected', 'cancelled', 'expired'));
end
$$;

-- Cierra las promociones vencidas y envía los recordatorios. Devuelve cuántas procesó de cada tipo.
create or replace function public.process_promotion_expiry()
returns table (expired_count integer, reminded_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo record;
  expired_total integer := 0;
  reminded_total integer := 0;
  days_left integer;
begin
  -- 1) Planes cuya fecha de término ya pasó.
  for promo in
    select p.id, p.user_id, p.service_title, p.plan_name, s.premium_until
    from public.service_promotions p
    left join public.services s on s.id = p.service_id
    where p.status = 'active' and p.ends_at is not null and p.ends_at <= now()
    for update of p skip locked
  loop
    update public.service_promotions set status = 'expired' where id = promo.id;
    expired_total := expired_total + 1;

    -- Si la publicación sigue premium por una renovación, no hay nada que avisar.
    if promo.premium_until is null or promo.premium_until <= now() then
      insert into public.user_notifications (user_id, type, title, body, link)
      values (promo.user_id, 'promotion_expired', 'Tu plan premium venció',
              format('«%s» dejó de estar destacada en la portada. Puedes renovar «%s» desde Planes.', promo.service_title, promo.plan_name),
              '/planes');
    end if;
  end loop;

  -- 2) Planes que vencen en los próximos 3 días (y no se han renovado).
  for promo in
    select p.id, p.user_id, p.service_title, p.ends_at
    from public.service_promotions p
    left join public.services s on s.id = p.service_id
    where p.status = 'active'
      and p.ends_at > now()
      and p.ends_at <= now() + interval '3 days'
      and p.reminder_sent_at is null
      and (s.premium_until is null or s.premium_until <= p.ends_at)
    for update of p skip locked
  loop
    update public.service_promotions set reminder_sent_at = now() where id = promo.id;
    reminded_total := reminded_total + 1;
    days_left := greatest(1, ceil(extract(epoch from (promo.ends_at - now())) / 86400)::integer);

    insert into public.user_notifications (user_id, type, title, body, link)
    values (promo.user_id, 'promotion_expiring', 'Tu plan premium vence pronto',
            format('«%s» dejará de estar destacada en %s %s (el %s). Puedes renovar el plan desde Planes.',
                   promo.service_title, days_left, case when days_left = 1 then 'día' else 'días' end,
                   to_char(promo.ends_at at time zone 'America/Santiago', 'DD-MM-YYYY')),
            '/planes');
  end loop;

  return query select expired_total, reminded_total;
end
$$;

-- Solo la ejecutan pg_cron (superusuario) y la función de administración de abajo.
revoke all on function public.process_promotion_expiry() from public, anon, authenticated;

-- Para el panel de administración: ejecuta el cierre ahora mismo.
create or replace function public.admin_process_promotion_expiry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_category_admin()) then
    raise exception 'No tienes permiso para gestionar promociones.';
  end if;
  perform public.process_promotion_expiry();
end
$$;

revoke all on function public.admin_process_promotion_expiry() from public, anon;
grant execute on function public.admin_process_promotion_expiry() to authenticated;

-- Programación cada hora (minuto 0). Si pg_cron no se puede activar desde aquí, habilítalo en Database > Extensions y vuelve a ejecutar.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'process-promotion-expiry';
  perform cron.schedule('process-promotion-expiry', '0 * * * *', 'select public.process_promotion_expiry()');
exception when others then
  raise notice 'No se pudo programar pg_cron (%). Habilítalo en Database > Extensions y vuelve a ejecutar este script; mientras tanto el panel /admin/promociones cierra los vencidos al abrirse.', sqlerrm;
end
$$;

notify pgrst, 'reload schema';
