-- Asigna publicaciones de prueba (dummy-services.sql) a una cuenta real de Supabase Auth.
--
-- IMPORTANTE: asigna solo las publicaciones cuyo "provider_name" coincide con el nombre de esa cuenta.
-- Una versión anterior de este script asignaba TODAS las publicaciones a un único usuario, y por eso el perfil
-- público de esa persona mostraba servicios de otros nombres (ver fix-dummy-provider-ownership.sql).
--
-- 1) Crea el usuario en Supabase Auth desde el Dashboard o desde la app.
-- 2) Consulta su UUID:  select id, email from auth.users where email = 'provider@dummy.com';
-- 3) Reemplaza el UUID y el nombre de abajo y ejecuta el script.

update public.services
set provider_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
where lower(btrim(provider_name)) = lower(btrim('Nombre del profesional'))
  and provider_id is null;
