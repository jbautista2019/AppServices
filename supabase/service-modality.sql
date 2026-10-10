-- Modalidad de atención de cada servicio: local comercial y/o a domicilio. Ejecutar en Supabase > SQL Editor (idempotente).
-- Los servicios existentes quedan como "local comercial" por defecto.

alter table public.services
  add column if not exists offers_local boolean not null default true,
  add column if not exists offers_home boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_modality_check' and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_modality_check check (offers_local or offers_home);
  end if;
end
$$;

notify pgrst, 'reload schema';
