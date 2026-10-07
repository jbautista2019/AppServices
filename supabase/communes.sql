-- Comunas de la Región Metropolitana de Santiago (52), usadas por el autocompletado de ubicación.
-- Ejecutar en Supabase > SQL Editor (idempotente).

create table if not exists public.communes (
  name text primary key check (length(btrim(name)) > 0),
  province text not null
);

alter table public.communes enable row level security;

drop policy if exists "Communes are public" on public.communes;
create policy "Communes are public"
  on public.communes for select
  to anon, authenticated
  using (true);

revoke all on public.communes from public, anon, authenticated;
grant select on public.communes to anon, authenticated;

insert into public.communes (name, province) values
  ('Cerrillos', 'Santiago'), ('Cerro Navia', 'Santiago'), ('Conchalí', 'Santiago'),
  ('El Bosque', 'Santiago'), ('Estación Central', 'Santiago'), ('Huechuraba', 'Santiago'),
  ('Independencia', 'Santiago'), ('La Cisterna', 'Santiago'), ('La Florida', 'Santiago'),
  ('La Granja', 'Santiago'), ('La Pintana', 'Santiago'), ('La Reina', 'Santiago'),
  ('Las Condes', 'Santiago'), ('Lo Barnechea', 'Santiago'), ('Lo Espejo', 'Santiago'),
  ('Lo Prado', 'Santiago'), ('Macul', 'Santiago'), ('Maipú', 'Santiago'),
  ('Ñuñoa', 'Santiago'), ('Pedro Aguirre Cerda', 'Santiago'), ('Peñalolén', 'Santiago'),
  ('Providencia', 'Santiago'), ('Pudahuel', 'Santiago'), ('Quilicura', 'Santiago'),
  ('Quinta Normal', 'Santiago'), ('Recoleta', 'Santiago'), ('Renca', 'Santiago'),
  ('San Joaquín', 'Santiago'), ('San Miguel', 'Santiago'), ('San Ramón', 'Santiago'),
  ('Santiago', 'Santiago'), ('Vitacura', 'Santiago'),
  ('Puente Alto', 'Cordillera'), ('Pirque', 'Cordillera'), ('San José de Maipo', 'Cordillera'),
  ('Colina', 'Chacabuco'), ('Lampa', 'Chacabuco'), ('Tiltil', 'Chacabuco'),
  ('San Bernardo', 'Maipo'), ('Buin', 'Maipo'), ('Calera de Tango', 'Maipo'), ('Paine', 'Maipo'),
  ('Melipilla', 'Melipilla'), ('Alhué', 'Melipilla'), ('Curacaví', 'Melipilla'),
  ('María Pinto', 'Melipilla'), ('San Pedro', 'Melipilla'),
  ('Talagante', 'Talagante'), ('El Monte', 'Talagante'), ('Isla de Maipo', 'Talagante'),
  ('Padre Hurtado', 'Talagante'), ('Peñaflor', 'Talagante')
on conflict (name) do nothing;

notify pgrst, 'reload schema';
