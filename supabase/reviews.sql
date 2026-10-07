-- Módulo de valoraciones. Ejecutar en Supabase > SQL Editor (idempotente).
--
-- Flujo:
--   1. El dueño de una publicación ACTIVA abre un chat con otra persona y pulsa "Solicitar valoración".
--      request_review() crea la solicitud y envía un mensaje con el enlace /valorar/<id>.
--   2. La otra persona abre el enlace, elige de 1 a 5 estrellas y un comentario opcional.
--      submit_review() guarda la valoración y recalcula services.rating (promedio).
--   Cada persona puede valorar un servicio una sola vez. Nadie puede editar services.rating a mano.

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null references public.services(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  service_title text not null,
  requester_name text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint review_requests_distinct_users check (requester_id <> recipient_id),
  constraint review_requests_service_recipient_key unique (service_id, recipient_id)
);

create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null references public.services(id) on delete cascade,
  request_id uuid not null unique references public.review_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 1000),
  created_at timestamptz not null default now(),
  constraint service_reviews_service_reviewer_key unique (service_id, reviewer_id)
);

create index if not exists service_reviews_service_created_idx
  on public.service_reviews (service_id, created_at desc);

alter table public.review_requests enable row level security;
alter table public.service_reviews enable row level security;

drop policy if exists "Participants read review requests" on public.review_requests;
create policy "Participants read review requests"
  on public.review_requests for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Reviews are public" on public.service_reviews;
create policy "Reviews are public"
  on public.service_reviews for select
  to anon, authenticated
  using (true);

-- Solo lectura directa: crear solicitudes y valoraciones pasa por las funciones de abajo.
revoke all on public.review_requests from public, anon, authenticated;
revoke all on public.service_reviews from public, anon, authenticated;
grant select on public.review_requests to authenticated;
grant select on public.service_reviews to anon, authenticated;

-- Evita que el dueño edite la calificación a mano: solo submit_review() puede cambiarla.
create or replace function public.protect_service_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.allow_rating_update', true) = '1' or (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.rating := 0;
  else
    new.rating := old.rating;
  end if;
  return new;
end
$$;

drop trigger if exists services_protect_rating on public.services;
create trigger services_protect_rating
  before insert or update on public.services
  for each row execute function public.protect_service_rating();

create or replace function public.request_review(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  conv record;
  svc record;
  req record;
  request_uuid uuid;
begin
  if caller_id is null then
    raise exception 'Inicia sesión para solicitar una valoración.';
  end if;

  select * into conv from public.conversations where id = p_conversation_id;
  if not found or conv.provider_id <> caller_id then
    raise exception 'Solo el dueño de la publicación puede solicitar valoraciones.';
  end if;

  select * into svc from public.services where id = conv.service_id;
  if not found or not svc.is_active then
    raise exception 'La publicación debe estar activa para solicitar valoraciones.';
  end if;

  if exists (
    select 1 from auth.users
    where id = conv.client_id and banned_until is not null and banned_until > now()
  ) then
    raise exception 'La cuenta de esta persona no está activa.';
  end if;

  select * into req
  from public.review_requests
  where service_id = svc.id and recipient_id = conv.client_id;

  if found then
    if req.completed_at is not null then
      raise exception 'Esta persona ya valoró tu servicio.';
    end if;
    request_uuid := req.id;
  else
    insert into public.review_requests (service_id, requester_id, recipient_id, service_title, requester_name)
    values (svc.id, caller_id, conv.client_id, svc.title, svc.provider_name)
    returning id into request_uuid;
  end if;

  insert into public.messages (conversation_id, sender_id, content)
  values (
    p_conversation_id,
    caller_id,
    format(E'⭐ Te invito a valorar mi servicio «%s». Tu opinión ayuda a otras personas.\n/valorar/%s', svc.title, request_uuid)
  );

  return request_uuid;
end
$$;

revoke all on function public.request_review(uuid) from public;
grant execute on function public.request_review(uuid) to authenticated;

create or replace function public.submit_review(p_request_id uuid, p_rating integer, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  req record;
  reviewer text;
  clean_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if caller_id is null then
    raise exception 'Inicia sesión para valorar.';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'La valoración debe ser de 1 a 5 estrellas.';
  end if;
  if clean_comment is not null and length(clean_comment) > 1000 then
    raise exception 'El comentario no puede superar los 1000 caracteres.';
  end if;

  select * into req from public.review_requests where id = p_request_id for update;
  if not found or req.recipient_id <> caller_id then
    raise exception 'Esta solicitud no existe o no es para ti.';
  end if;
  if req.completed_at is not null then
    raise exception 'Ya enviaste tu valoración para este servicio.';
  end if;

  select coalesce(
    nullif(raw_user_meta_data ->> 'full_name', ''),
    nullif(raw_user_meta_data ->> 'name', ''),
    nullif(split_part(email, '@', 1), ''),
    'Cliente'
  ) into reviewer
  from auth.users
  where id = caller_id;

  insert into public.service_reviews (service_id, request_id, reviewer_id, reviewer_name, rating, comment)
  values (req.service_id, req.id, caller_id, coalesce(reviewer, 'Cliente'), p_rating, clean_comment);

  update public.review_requests set completed_at = now() where id = req.id;

  perform set_config('app.allow_rating_update', '1', true);
  update public.services
  set rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.service_reviews r where r.service_id = req.service_id), 0)
  where id = req.service_id;
  perform set_config('app.allow_rating_update', '', true);
end
$$;

revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
