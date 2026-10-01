-- Asigna todas las publicaciones dummy a un usuario real de Supabase Auth.
-- 1) Crea el usuario en Supabase Auth desde el Dashboard o desde la app.
-- 2) Consulta su UUID:
--    select id, email from auth.users where email = 'provider@dummy.com';
-- 3) Reemplaza el UUID de abajo por el que te devuelva Supabase.
-- 4) Ejecuta este script.

-- Cambia este valor:
-- \\n--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- \

update public.services
set provider_id = '46ac7220-cf27-437b-9730-c8c4b76b3e5a'
where title in (
  'Plomería a domicilio',
  'Limpieza profunda de departamentos',
  'Mantenimiento de jardines',
  'Electricista residencial',
  'Armado de muebles',
  'Pintura interior',
  'Manicura y nail art',
  'Maquillaje para eventos',
  'Corte y color profesional',
  'Depilación corporal',
  'Reparación de computadores',
  'Reparación de lavadoras',
  'Soporte técnico hogar',
  'Clases de matemáticas',
  'Clases de inglés',
  'Tutoría de ciencias',
  'Clases de guitarra',
  'Diseño de jardines',
  'Podas y desmalezado',
  'Decoración de eventos',
  'Catering para eventos',
  'Sonido para eventos',
  'Planificación de fiestas'
);

-- Si necesitas asegurar que todas las publicaciones queden con usuario:
-- update public.services
-- set provider_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- where provider_id is null;
