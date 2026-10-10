-- Reparte las publicaciones de prueba entre las 3 cuentas reales y elimina el resto de los datos de prueba.
-- Ejecutar en Supabase > SQL Editor. Revisa primero el PASO 1 (solo consulta); el PASO 2 modifica y borra datos.
--
-- Cuentas reales (la cuenta administradora appservicesjkl queda fuera):
--   Alejandro        ebfe7fb6-a94f-4813-a45e-5361f34b1db7
--   jacklin bautista 46ac7220-cf27-437b-9730-c8c4b76b3e5a
--   Lennys Bolivar   ea3d21c1-c67d-4f18-bf35-bf79ea4e16fa
--
-- Qué hace el PASO 2:
--   a) Las 23 publicaciones de dummy-services.sql se reparten por turnos (1,2,3,1,2,3...) entre las 3 cuentas y su
--      "provider_name" pasa a ser el nombre de la cuenta dueña.
--   b) Para las publicaciones que cambian de dueño se borran las conversaciones y mensajes, las solicitudes de
--      valoración y las valoraciones asociadas (eran de prueba y quedarían inconsistentes con el nuevo dueño).
--   c) Se borran las publicaciones de prueba sin dueño real: las de seed.sql ("[PRUEBA] ...") y cualquier otra con
--      provider_id nulo. Sus favoritos, reportes y valoraciones se eliminan en cascada.
--   Las publicaciones reales creadas desde la app (por ejemplo "Gasfiteria") no se tocan.

-- ===== PASO 1: vista previa (no modifica nada) =====
select s.id, s.title, s.provider_name,
       case
         when s.provider_id is null then 'SE BORRA (sin dueño)'
         when s.title like '[PRUEBA]%' then 'SE BORRA (seed)'
         else 'se conserva / se reparte'
       end as accion
from public.services s
order by accion, s.id;

-- ===== PASO 2: aplicar =====
-- Es UNA sola sentencia (el editor de Supabase no conserva tablas temporales entre sentencias), así que es atómica:
-- si algo falla no se cambia nada. Ejecútala completa (desde "with" hasta el ";" final).
with real_owners as (
  select
    row_number() over (order by u.email) as ord,
    u.id,
    coalesce(
      nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
      split_part(u.email, '@', 1)
    ) as display_name
  from auth.users u
  where u.id in (
    'ebfe7fb6-a94f-4813-a45e-5361f34b1db7',
    '46ac7220-cf27-437b-9730-c8c4b76b3e5a',
    'ea3d21c1-c67d-4f18-bf35-bf79ea4e16fa'
  )
),
-- Si no hay exactamente 3 cuentas, esto divide por cero y la sentencia se aborta sin tocar nada.
guard as (
  select 1 / case when count(*) = 3 then 1 else 0 end as ok from real_owners
),
-- Publicaciones de dummy-services.sql y el dueño que les toca (por turnos, en orden de id).
dummy_moves as (
  select
    d.id as service_id,
    d.provider_id as old_owner,
    o.id as new_owner,
    o.display_name as new_name
  from (
    select s.id, s.provider_id, row_number() over (order by s.id) as rn
    from public.services s
    where s.title in (
      'Plomería a domicilio', 'Limpieza profunda de departamentos', 'Mantenimiento de jardines',
      'Electricista residencial', 'Armado de muebles', 'Pintura interior', 'Manicura y nail art',
      'Maquillaje para eventos', 'Corte y color profesional', 'Depilación corporal',
      'Reparación de computadores', 'Reparación de lavadoras', 'Soporte técnico hogar',
      'Clases de matemáticas', 'Clases de inglés', 'Tutoría de ciencias', 'Clases de guitarra',
      'Diseño de jardines', 'Podas y desmalezado', 'Decoración de eventos', 'Catering para eventos',
      'Sonido para eventos', 'Planificación de fiestas'
    )
      and (s.provider_id is null or s.provider_id in (select id from real_owners))
  ) d
  cross join guard
  join real_owners o on o.ord = ((d.rn - 1) % 3) + 1
),
-- b) Datos asociados a las publicaciones que cambian de dueño.
deleted_conversations as (
  delete from public.conversations c
  using dummy_moves m
  where c.service_id = m.service_id
    and c.provider_id is distinct from m.new_owner
  returning c.id
),
deleted_reviews as (
  delete from public.service_reviews r
  using dummy_moves m
  where r.service_id = m.service_id
    and m.old_owner is distinct from m.new_owner
  returning r.id
),
deleted_requests as (
  delete from public.review_requests q
  using dummy_moves m
  where q.service_id = m.service_id
    and m.old_owner is distinct from m.new_owner
  returning q.id
),
-- a) Nuevo dueño y nombre de profesional.
updated_services as (
  update public.services s
  set provider_id = m.new_owner,
      provider_name = m.new_name
  from dummy_moves m
  where s.id = m.service_id
  returning s.id
),
-- c) Resto de datos de prueba sin dueño real (las repartidas se excluyen).
deleted_services as (
  delete from public.services s
  where (s.provider_id is null or s.title like '[PRUEBA]%')
    and s.id not in (select service_id from dummy_moves)
  returning s.id
)
select
  (select count(*) from updated_services) as publicaciones_repartidas,
  (select count(*) from deleted_services) as publicaciones_borradas,
  (select count(*) from deleted_conversations) as conversaciones_borradas,
  (select count(*) from deleted_reviews) as valoraciones_borradas,
  (select count(*) from deleted_requests) as solicitudes_borradas;

-- ===== VERIFICACIÓN: publicaciones por cuenta y ninguna sin dueño =====
select coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), u.email) as cuenta, count(s.id) as publicaciones
from auth.users u
left join public.services s on s.provider_id = u.id
where u.id in (
  'ebfe7fb6-a94f-4813-a45e-5361f34b1db7',
  '46ac7220-cf27-437b-9730-c8c4b76b3e5a',
  'ea3d21c1-c67d-4f18-bf35-bf79ea4e16fa'
)
group by 1
order by 1;

select count(*) as publicaciones_sin_dueno from public.services where provider_id is null;
