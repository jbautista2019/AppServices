-- Corrige la imagen de la categoría Jardinería (compartía imagen con Belleza). Ejecutar en Supabase > SQL Editor.
-- También puedes cambiarla desde /admin/categorias subiendo una imagen propia.

update public.categories
set image_url = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=700&q=82'
where lower(btrim(name)) in ('jardinería', 'jardineria');

-- Verificación: cada categoría debería tener una imagen distinta.
select name, image_url from public.categories order by name;
