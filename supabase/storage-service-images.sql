-- Almacenamiento de imágenes de servicios. Ejecutar en Supabase > SQL Editor (idempotente).
-- Bucket público de lectura; cada usuario solo puede subir/modificar/borrar en su propia carpeta (<user_id>/...).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Service images are public" on storage.objects;
create policy "Service images are public"
  on storage.objects for select
  to public
  using (bucket_id = 'service-images');

drop policy if exists "Users upload own service images" on storage.objects;
create policy "Users upload own service images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'service-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update own service images" on storage.objects;
create policy "Users update own service images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'service-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own service images" on storage.objects;
create policy "Users delete own service images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'service-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
