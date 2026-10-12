-- Gestión de planes premium desde el panel de administración (/admin/planes). Ejecutar en Supabase > SQL Editor (idempotente).
-- Requiere antes: supabase/premium-plans.sql.
--
-- Todo se guarda en public.premium_plans. Los administradores (public.category_admins) pueden ver todos los planes (también los
-- inactivos) y crearlos, editarlos o eliminarlos mediante funciones que validan los datos. Las solicitudes de promoción guardan una
-- copia del nombre, precio y duración del plan al momento de pedirlo, así que editar un plan no altera las solicitudes ya hechas.

drop policy if exists "Admins read all plans" on public.premium_plans;
create policy "Admins read all plans"
  on public.premium_plans for select
  to authenticated
  using ((select public.is_category_admin()));

-- Crea (p_id nulo) o actualiza un plan. Devuelve su id.
create or replace function public.admin_save_plan(
  p_id text,
  p_name text,
  p_description text,
  p_days integer,
  p_price_clp integer,
  p_features text[],
  p_highlighted boolean,
  p_is_active boolean,
  p_sort_order integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_key text;
  clean_name text := btrim(coalesce(p_name, ''));
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
  clean_features text[];
begin
  if not (select public.is_category_admin()) then
    raise exception 'Solo un administrador puede gestionar los planes.';
  end if;
  if clean_name = '' or length(clean_name) > 80 then
    raise exception 'El nombre es obligatorio y puede tener hasta 80 caracteres.';
  end if;
  if clean_description is not null and length(clean_description) > 300 then
    raise exception 'La descripción puede tener hasta 300 caracteres.';
  end if;
  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'La duración debe estar entre 1 y 3650 días.';
  end if;
  if p_price_clp is null or p_price_clp < 0 or p_price_clp > 100000000 then
    raise exception 'El precio no es válido.';
  end if;

  clean_features := array(
    select btrim(f) from unnest(coalesce(p_features, '{}'::text[])) as f where btrim(f) <> ''
  );
  if coalesce(array_length(clean_features, 1), 0) > 12 then
    raise exception 'Un plan puede tener hasta 12 características.';
  end if;
  if exists (select 1 from unnest(clean_features) as f where length(f) > 200) then
    raise exception 'Cada característica puede tener hasta 200 caracteres.';
  end if;

  if p_id is null or btrim(p_id) = '' then
    plan_key := 'plan-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    insert into public.premium_plans (id, name, description, days, price_clp, features, highlighted, is_active, sort_order)
    values (plan_key, clean_name, clean_description, p_days, p_price_clp, clean_features,
            coalesce(p_highlighted, false), coalesce(p_is_active, true), coalesce(p_sort_order, 0));
  else
    update public.premium_plans
    set name = clean_name,
        description = clean_description,
        days = p_days,
        price_clp = p_price_clp,
        features = clean_features,
        highlighted = coalesce(p_highlighted, false),
        is_active = coalesce(p_is_active, true),
        sort_order = coalesce(p_sort_order, 0)
    where id = p_id;
    if not found then
      raise exception 'El plan no existe.';
    end if;
    plan_key := p_id;
  end if;

  return plan_key;
end
$$;

revoke all on function public.admin_save_plan(text, text, text, integer, integer, text[], boolean, boolean, integer) from public, anon;
grant execute on function public.admin_save_plan(text, text, text, integer, integer, text[], boolean, boolean, integer) to authenticated;

-- Elimina un plan que nunca se haya solicitado; si ya tiene solicitudes hay que desactivarlo.
create or replace function public.admin_delete_plan(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_category_admin()) then
    raise exception 'Solo un administrador puede gestionar los planes.';
  end if;
  if exists (select 1 from public.service_promotions where plan_id = p_id) then
    raise exception 'Este plan ya tiene solicitudes. Desactívalo en lugar de eliminarlo para conservar el historial.';
  end if;

  delete from public.premium_plans where id = p_id;
  if not found then
    raise exception 'El plan no existe.';
  end if;
end
$$;

revoke all on function public.admin_delete_plan(text) from public, anon;
grant execute on function public.admin_delete_plan(text) to authenticated;

notify pgrst, 'reload schema';
