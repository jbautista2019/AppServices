-- Búsqueda híbrida (texto + semántica) para el buscador principal. Ejecutar en Supabase > SQL Editor (idempotente).
--
-- Cómo funciona:
--   * Texto: full-text search en español sin tildes, tolerancia a errores de tipeo (pg_trgm), coincidencia
--     exacta (título, categoría, comuna, prestador) y sinónimos chilenos (tabla search_synonyms).
--   * Semántica: embeddings de 384 dimensiones (modelo gte-small) generados por la Edge Function
--     "semantic-search" y guardados en services.embedding.
--   * Se combinan con Reciprocal Rank Fusion. Las búsquedas cortas ("Maipú", "gasfíter") priorizan el texto
--     y exigen más similitud semántica; las frases largas ("me gotea el techo") priorizan la semántica.
--     Una coincidencia exacta siempre queda primero.

create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.services
  add column if not exists embedding extensions.vector(384);

-- Los clientes no pueden escribir embeddings (solo la Edge Function con service_role), y editar el texto
-- de un servicio invalida su embedding para que se recalcule.
create or replace function public.manage_service_embedding()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.embedding := null;
    else
      new.embedding := old.embedding;
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.title is distinct from old.title
    or new.category is distinct from old.category
    or new.description is distinct from old.description
    or new.location is distinct from old.location
  ) and new.embedding is not distinct from old.embedding then
    new.embedding := null;
  end if;

  return new;
end
$$;

drop trigger if exists services_manage_embedding on public.services;
create trigger services_manage_embedding
  before insert or update on public.services
  for each row execute function public.manage_service_embedding();

-- Sinónimos y jerga chilena, agrupados por 'term' (cabeza del grupo). Cualquier palabra del grupo activa a todo el
-- grupo; los grupos no se encadenan entre sí. En minúsculas y sin tildes.
create table if not exists public.search_synonyms (
  term text not null,
  synonym text not null,
  primary key (term, synonym)
);

alter table public.search_synonyms enable row level security;
drop policy if exists "Synonyms are public" on public.search_synonyms;
create policy "Synonyms are public"
  on public.search_synonyms for select
  to anon, authenticated
  using (true);
revoke all on public.search_synonyms from public, anon, authenticated;
grant select on public.search_synonyms to anon, authenticated;

insert into public.search_synonyms (term, synonym) values
  ('gasfiter', 'plomero'), ('gasfiter', 'gasfiteria'), ('gasfiter', 'plomeria'), ('gasfiter', 'canerias'),
  ('gasfiter', 'tuberias'), ('gasfiter', 'fuga'), ('gasfiter', 'filtracion'), ('gasfiter', 'llave'),
  ('gasfiter', 'inodoro'), ('gasfiter', 'calefont'), ('gasfiter', 'destape'), ('gasfiter', 'banos'),
  ('gotera', 'gotea'), ('gotera', 'goteras'), ('gotera', 'gotas'), ('gotera', 'techo'), ('gotera', 'techumbre'),
  ('gotera', 'humedad'), ('gotera', 'filtracion'), ('gotera', 'impermeabilizacion'),
  ('electricista', 'electrico'), ('electricista', 'electricidad'), ('electricista', 'enchufe'),
  ('electricista', 'tablero'), ('electricista', 'cableado'), ('electricista', 'cortocircuito'), ('electricista', 'luz'),
  ('peluquero', 'peluqueria'), ('peluquero', 'peluquera'), ('peluquero', 'estilista'), ('peluquero', 'barbero'),
  ('peluquero', 'corte'), ('peluquero', 'tinte'), ('peluquero', 'pelo'),
  ('manicure', 'manicurista'), ('manicure', 'unas'), ('manicure', 'nail'), ('manicure', 'pedicure'), ('manicure', 'esmaltado'),
  ('podologo', 'podologia'), ('podologo', 'pies'), ('podologo', 'callos'), ('podologo', 'unas encarnadas'),
  ('jardinero', 'jardin'), ('jardinero', 'jardineria'), ('jardinero', 'poda'), ('jardinero', 'pasto'),
  ('jardinero', 'cesped'), ('jardinero', 'plantas'), ('jardinero', 'riego'),
  ('computador', 'computacion'), ('computador', 'notebook'), ('computador', 'laptop'), ('computador', 'pc'),
  ('computador', 'formateo'), ('computador', 'tecnico'),
  ('profesor', 'clases'), ('profesor', 'profesora'), ('profesor', 'particular'), ('profesor', 'reforzamiento'),
  ('profesor', 'tutoria'), ('profesor', 'tutor'),
  ('mecanico', 'auto'), ('mecanico', 'vehiculo'), ('mecanico', 'taller'), ('mecanico', 'motor'), ('mecanico', 'frenos'),
  ('pintor', 'pintura'), ('pintor', 'pintar'), ('pintor', 'muros'), ('pintor', 'paredes'),
  ('carpintero', 'carpinteria'), ('carpintero', 'madera'), ('carpintero', 'muebles'), ('carpintero', 'closet'),
  ('aseo', 'limpieza'), ('aseo', 'limpiar'), ('aseo', 'aseadora'),
  ('fotografo', 'fotografia'), ('fotografo', 'fotos'), ('fotografo', 'sesion'),
  ('maquillador', 'maquillaje'), ('maquillador', 'maquilladora'),
  ('maestro', 'constructor'), ('maestro', 'construccion'), ('maestro', 'albanil'), ('maestro', 'remodelacion'),
  ('lavadora', 'electrodomestico'), ('lavadora', 'refrigerador'), ('lavadora', 'reparacion')
on conflict do nothing;

-- Raíces de las palabras de un texto, con y sin tildes. El stemmer español solo reconoce sufijos acentuados
-- ("gasfitería" -> gasfit, "gasfiteria" -> gasfiteri), por eso se indexan y buscan ambas variantes.
create or replace function public.search_stems(p_text text)
returns text[]
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(array_agg(distinct s), '{}')
  from unnest(
    tsvector_to_array(to_tsvector('spanish', coalesce(p_text, '')))
    || tsvector_to_array(to_tsvector('spanish', extensions.unaccent(coalesce(p_text, ''))))
  ) as s;
$$;

-- Documento de búsqueda de un servicio (título pesa más que la descripción), con y sin tildes.
create or replace function public.search_document(
  p_title text, p_category text, p_location text, p_description text, p_provider text
)
returns tsvector
language sql
stable
set search_path = public, extensions
as $$
  select
    setweight(to_tsvector('spanish', p_title) || to_tsvector('spanish', extensions.unaccent(p_title)), 'A')
    || setweight(to_tsvector('spanish', p_category) || to_tsvector('spanish', extensions.unaccent(p_category)), 'B')
    || setweight(to_tsvector('spanish', p_location) || to_tsvector('spanish', extensions.unaccent(p_location)), 'B')
    || setweight(to_tsvector('spanish', p_description) || to_tsvector('spanish', extensions.unaccent(p_description)), 'C')
    || setweight(to_tsvector('spanish', p_provider) || to_tsvector('spanish', extensions.unaccent(p_provider)), 'C');
$$;

-- Búsqueda híbrida. Devuelve los servicios activos relevantes ordenados por score.
-- p_embedding es el vector de la consulta (lo calcula la Edge Function); si es null solo se usa texto.
create or replace function public.search_services(
  p_query text,
  p_embedding extensions.vector(384) default null,
  p_min_similarity double precision default 0.82,
  p_limit integer default 60
)
returns table (
  service_id bigint,
  score double precision,
  text_match boolean,
  semantic_match boolean,
  semantic_similarity double precision
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  raw_query text := lower(btrim(coalesce(p_query, '')));
  q text := extensions.unaccent(lower(btrim(coalesce(p_query, ''))));
  raw_words text[];
  query_words text[];
  fuzzy_words text[];
  matched_synonyms text[];
  query_stems text[];
  all_terms text[];
  raw_terms text[];
  informative text[];
  tsq tsquery;
  total_services integer;
  max_common integer;
  word_count integer;
  text_weight double precision;
  semantic_weight double precision;
  min_similarity double precision := p_min_similarity;
  semantic_margin constant double precision := 0.02;
  semantic_max_results constant integer := 5;
begin
  if q = '' then
    return;
  end if;

  raw_words := array(
    select w from regexp_split_to_table(regexp_replace(raw_query, '[^a-záéíóúüñ0-9]+', ' ', 'g'), '\s+') as w where length(w) >= 2
  );
  query_words := array(
    select w from regexp_split_to_table(regexp_replace(q, '[^a-z0-9]+', ' ', 'g'), '\s+') as w where length(w) >= 2
  );
  word_count := coalesce(array_length(query_words, 1), 0);

  -- Errores de tipeo: palabras del vocabulario de sinónimos muy parecidas a las escritas ("electrisista" ~ electricista).
  fuzzy_words := array(
    select distinct v
    from (
      select regexp_split_to_table(s.term, '\s+') as v from public.search_synonyms s
      union
      select regexp_split_to_table(s.synonym, '\s+') from public.search_synonyms s
    ) vocab
    join unnest(query_words) as w on length(w) >= 5 and length(v) >= 5 and v <> w and extensions.similarity(w, v) >= 0.5
  );

  -- Sinónimos en ambos sentidos, comparando raíces (así "baño"/"baños" o "plomero"/"plomeros" coinciden).
  query_stems := public.search_stems(array_to_string(query_words || fuzzy_words, ' '));
  matched_synonyms := array(
    select distinct x
    from (
      select distinct s.term as head
      from public.search_synonyms s
      where public.search_stems(s.term) && query_stems or public.search_stems(s.synonym) && query_stems
    ) h
    cross join lateral (
      select h.head as member
      union
      select s2.synonym from public.search_synonyms s2 where s2.term = h.head
    ) m
    cross join lateral regexp_split_to_table(m.member, '\s+') as x
    where length(x) >= 2
  );

  all_terms := array(
    select distinct t from unnest(query_words || fuzzy_words || matched_synonyms) as t where t ~ '^[a-z0-9]+$'
  );
  raw_terms := array(select distinct t from unnest(raw_words) as t where t ~ '^[a-záéíóúüñ0-9]+$');

  -- Palabras demasiado comunes en el catálogo ("casa", "domicilio") no discriminan: se ignoran si quedan otras.
  select count(*) into total_services from public.services where is_active;
  if total_services >= 8 then
    max_common := greatest(3, floor(total_services * 0.3));
    informative := array(
      select t from unnest(all_terms) as t
      where (
        select count(*) from public.services s
        where s.is_active
          and public.search_document(s.title, s.category, s.location, s.description, s.provider_name) @@ to_tsquery('spanish', t)
      ) <= max_common
    );
    if coalesce(array_length(informative, 1), 0) > 0 then
      raw_terms := array(select r from unnest(raw_terms) as r where extensions.unaccent(r) = any (informative));
      all_terms := informative;
    end if;
  end if;

  if coalesce(array_length(all_terms, 1), 0) > 0 then
    tsq := to_tsquery('spanish', array_to_string(all_terms, ' | '));
    if coalesce(array_length(raw_terms, 1), 0) > 0 then
      tsq := tsq || to_tsquery('spanish', array_to_string(raw_terms, ' | '));
    end if;
  end if;

  -- Consultas cortas: manda el texto y la semántica debe ser más exigente. Frases largas: manda la semántica.
  if word_count <= 2 then
    text_weight := 1.0;
    semantic_weight := 0.5;
    min_similarity := min_similarity + 0.04;
  else
    text_weight := 0.6;
    semantic_weight := 1.0;
  end if;

  return query
  with base as (
    select
      s.id as sid,
      public.search_document(s.title, s.category, s.location, s.description, s.provider_name) as doc,
      lower(extensions.unaccent(s.title)) as u_title,
      lower(extensions.unaccent(s.category)) as u_category,
      lower(extensions.unaccent(s.location)) as u_location,
      lower(extensions.unaccent(s.provider_name)) as u_provider,
      case when p_embedding is not null and s.embedding is not null
        then 1 - (s.embedding <=> p_embedding) end as sim
    from public.services s
    where s.is_active
  ),
  scored as (
    select
      b.sid,
      b.sim,
      (tsq is not null and b.doc @@ tsq) as ts_hit,
      case when tsq is not null then ts_rank_cd(b.doc, tsq) else 0 end as ts_rank,
      case when tsq is not null then ts_rank_cd(b.doc, tsq, 32) else 0 end as ts_quality,
      greatest(
        extensions.similarity(b.u_title, q),
        extensions.similarity(b.u_category, q),
        extensions.similarity(b.u_location, q)
      ) as trgm,
      exists (
        select 1 from unnest(query_words) as w
        where length(w) >= 5
          and extensions.word_similarity(w, b.u_title || ' ' || b.u_category || ' ' || b.u_location) >= 0.6
      ) as typo_hit,
      (position(q in b.u_title) > 0 or position(q in b.u_category) > 0
        or position(q in b.u_location) > 0 or position(q in b.u_provider) > 0) as exact
    from base b
  ),
  flagged as (
    select
      sc.*,
      (sc.ts_hit or sc.typo_hit or sc.trgm >= 0.3 or sc.exact) as text_hit
    from scored sc
  ),
  top_sem as (
    select max(f.sim) as top_sim from flagged f
  ),
  sem_ranked as (
    select f.sid, row_number() over (order by f.sim desc, f.sid) as rn
    from flagged f, top_sem ts
    where f.sim is not null and f.sim >= greatest(min_similarity, ts.top_sim - semantic_margin)
  ),
  text_ranked as (
    select f.sid, row_number() over (order by f.exact desc, f.ts_rank + f.trgm desc, f.sid) as rn
    from flagged f where f.text_hit
  )
  select
    f.sid,
    (coalesce(text_weight / (60 + t.rn), 0)
      + coalesce(semantic_weight / (60 + m.rn), 0)
      + case when f.text_hit then 0.08 * f.ts_quality else 0 end
      + case when f.exact then 0.1 else 0 end)::double precision,
    f.text_hit,
    (m.rn is not null),
    f.sim::double precision
  from flagged f
  left join text_ranked t on t.sid = f.sid
  left join sem_ranked m on m.sid = f.sid and m.rn <= semantic_max_results
  where f.text_hit or (m.rn is not null)
  order by 2 desc, f.sid
  limit p_limit;
end
$$;

revoke all on function public.search_services(text, extensions.vector, double precision, integer) from public;
grant execute on function public.search_services(text, extensions.vector, double precision, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
