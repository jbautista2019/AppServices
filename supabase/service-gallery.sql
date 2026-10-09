-- Galería de fotos de las publicaciones. Ejecutar en Supabase > SQL Editor (idempotente).
--
-- services.image_url sigue siendo la foto de portada. gallery_urls guarda hasta 2 fotos adicionales
-- (3 fotos en total por publicación)
-- (URLs públicas del bucket service-images, que ya crea supabase/storage-service-images.sql).

alter table public.services add column if not exists gallery_urls text[] not null default '{}';

alter table public.services drop constraint if exists services_gallery_urls_max;
alter table public.services
  add constraint services_gallery_urls_max check (cardinality(gallery_urls) <= 2) not valid;

notify pgrst, 'reload schema';
