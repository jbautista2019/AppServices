-- Servicios favoritos de cada persona. Ejecutar en Supabase > SQL Editor (idempotente).
--
-- Cada persona guarda, ve y quita solo sus propios favoritos. Si la publicación se elimina, el favorito desaparece con ella.

create table if not exists public.service_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id bigint not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create index if not exists service_favorites_user_created_idx
  on public.service_favorites (user_id, created_at desc);

alter table public.service_favorites enable row level security;

drop policy if exists "Users read their own favorites" on public.service_favorites;
create policy "Users read their own favorites"
  on public.service_favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users add their own favorites" on public.service_favorites;
create policy "Users add their own favorites"
  on public.service_favorites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users remove their own favorites" on public.service_favorites;
create policy "Users remove their own favorites"
  on public.service_favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.service_favorites from public, anon, authenticated;
grant select, insert, delete on public.service_favorites to authenticated;

notify pgrst, 'reload schema';
