-- Perfil público de los profesionales (descripción y teléfono/WhatsApp). Ejecutar en Supabase > SQL Editor (idempotente).
--
-- Cada persona edita solo su propia fila. La lectura es pública porque se muestra en /profesional/<id>
-- y en el detalle de sus publicaciones; el teléfono solo existe si la persona decide escribirlo.

create table if not exists public.provider_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bio text check (bio is null or length(bio) <= 500),
  phone text check (phone is null or length(phone) <= 30),
  updated_at timestamptz not null default now()
);

alter table public.provider_profiles enable row level security;

drop policy if exists "Provider profiles are public" on public.provider_profiles;
create policy "Provider profiles are public"
  on public.provider_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users create their own provider profile" on public.provider_profiles;
create policy "Users create their own provider profile"
  on public.provider_profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update their own provider profile" on public.provider_profiles;
create policy "Users update their own provider profile"
  on public.provider_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.provider_profiles from public, anon, authenticated;
grant select on public.provider_profiles to anon, authenticated;
grant insert, update on public.provider_profiles to authenticated;

notify pgrst, 'reload schema';
