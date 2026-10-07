-- Limpieza de categorías de prueba (por ejemplo "categoria prueba") antes de lanzar la página.
-- Ejecutar en Supabase > SQL Editor, paso a paso.

-- 1) Revisa qué categorías de prueba existen y cuántos servicios tiene cada una.
select c.name, count(s.id) as servicios
from public.categories c
left join public.services s on s.category = c.name
where c.name ilike '%prueba%' or c.name ilike '%test%'
group by c.name
order by c.name;

-- 2) Si alguna tiene servicios, muévelos antes a una categoría real (cambia 'Hogar' si corresponde).
--    La base impide eliminar categorías con servicios asociados.
-- update public.services
-- set category = 'Hogar'
-- where category ilike '%prueba%' or category ilike '%test%';

-- 3) Elimina las categorías de prueba que ya no tengan servicios (las que sí tienen se conservan).
delete from public.categories c
where (c.name ilike '%prueba%' or c.name ilike '%test%')
  and not exists (select 1 from public.services s where s.category = c.name);

-- 4) Verificación: no debería quedar ninguna fila.
select name from public.categories where name ilike '%prueba%' or name ilike '%test%';
