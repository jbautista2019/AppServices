-- Corrige publicaciones de prueba que quedaron todas asociadas a una sola cuenta (por ejemplo la de Ana García),
-- aunque su "provider_name" es de otras personas (Karina Díaz, Daniela Pérez...). Por eso aparecían en el perfil
-- público de Ana. Ejecutar en Supabase > SQL Editor, paso a paso.
--
-- Las publicaciones que no tienen dueño real quedan sin cuenta (provider_id = null): la app ya lo soporta, no
-- muestran enlace al perfil y, al contactar, avisan que no están vinculadas a una cuenta profesional.

-- 1) Revisa qué publicaciones de esa cuenta pertenecen en realidad a otros nombres.
--    Ajusta el id de la cuenta y el nombre que SÍ le corresponde.
with owner as (
  select '46ac7220-cf27-437b-9730-c8c4b76b3e5a'::uuid as id, 'Ana García'::text as own_name
)
select s.id, s.title, s.provider_name
from public.services s
join owner o on s.provider_id = o.id
where lower(btrim(s.provider_name)) <> lower(btrim(o.own_name))
order by s.id;

-- 2) Si la lista del paso 1 es correcta, desvincúlalas de esa cuenta.
-- with owner as (
--   select '46ac7220-cf27-437b-9730-c8c4b76b3e5a'::uuid as id, 'Ana García'::text as own_name
-- )
-- update public.services s
-- set provider_id = null
-- from owner o
-- where s.provider_id = o.id
--   and lower(btrim(s.provider_name)) <> lower(btrim(o.own_name));

-- 3) Verificación: debería listar solo las publicaciones propias de la cuenta.
-- select id, title, provider_name from public.services
-- where provider_id = '46ac7220-cf27-437b-9730-c8c4b76b3e5a'::uuid;
