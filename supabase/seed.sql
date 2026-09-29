insert into public.categories (name)
values
  ('Hogar'),
  ('Belleza'),
  ('Reparaciones'),
  ('Clases'),
  ('Jardinería'),
  ('Eventos')
on conflict (name) do nothing;

insert into public.categories (name)
values
  ('Hogar'),
  ('Belleza'),
  ('Reparaciones'),
  ('Clases'),
  ('Jardinería'),
  ('Eventos')
on conflict (name) do nothing;

insert into public.services (
  title,
  provider_name,
  category,
  location,
  rating,
  starting_price,
  image_url,
  description,
  is_active
)
select
  sample.title,
  sample.provider_name,
  sample.category,
  sample.location,
  sample.rating,
  sample.starting_price,
  sample.image_url,
  sample.description,
  sample.is_active
from (
  values
    (
      '[PRUEBA] Gasfitería y reparaciones',
      'Juan Pérez',
      'Hogar',
      'Maipú',
      4.8,
      20000,
      'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=80',
      'Instalación y reparación de grifería, filtraciones y redes de agua. Atención a domicilio en Maipú y comunas cercanas.',
      true
    ),
    (
      '[PRUEBA] Manicure y nail art',
      'Natalia Rojas',
      'Belleza',
      'Ñuñoa',
      5.0,
      15000,
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
      'Manicure permanente y diseños personalizados, con opción de atención a domicilio en Ñuñoa.',
      true
    ),
    (
      '[PRUEBA] Reparación de computadores',
      'Matías Soto',
      'Reparaciones',
      'La Florida',
      4.9,
      18000,
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80',
      'Diagnóstico, limpieza y reparación de notebooks y computadores. Soporte remoto disponible.',
      true
    ),
    (
      '[PRUEBA] Mantención de jardines',
      'Claudia Muñoz',
      'Jardinería',
      'Las Condes',
      4.7,
      25000,
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=80',
      'Poda, mantención y asesoría para jardines y plantas de interior.',
      true
    ),
    (
      '[PRUEBA] Clases de matemáticas',
      'Diego Araya',
      'Clases',
      'Providencia',
      4.9,
      12000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Clases particulares para enseñanza media y preparación PAES, presenciales o en línea.',
      true
    ),
    (
      '[PRUEBA] Instalación eléctrica domiciliaria',
      'Laura Contreras',
      'Hogar',
      'Puente Alto',
      4.8,
      22000,
      'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=80',
      'Revisión de circuitos, instalación de luminarias y solución de fallas eléctricas en el hogar.',
      true
    ),
    (
      '[PRUEBA] Aseo profundo de departamentos',
      'Marcela Fuentes',
      'Hogar',
      'Providencia',
      4.9,
      30000,
      'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=80',
      'Limpieza profunda de cocina, baños y espacios comunes con productos incluidos.',
      true
    ),
    (
      '[PRUEBA] Armado de muebles',
      'Felipe Rojas',
      'Hogar',
      'Quilicura',
      4.6,
      16000,
      'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=80',
      'Armado e instalación de muebles de dormitorio, cocina y oficina.',
      true
    ),
    (
      '[PRUEBA] Maquillaje para eventos',
      'Fernanda Silva',
      'Belleza',
      'La Reina',
      4.9,
      28000,
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
      'Maquillaje social y de noche, con prueba previa y atención a domicilio.',
      true
    ),
    (
      '[PRUEBA] Corte y color a domicilio',
      'Valentina Muñoz',
      'Belleza',
      'Macul',
      4.8,
      24000,
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
      'Corte, tintura y asesoría de color personalizada en tu domicilio.',
      true
    ),
    (
      '[PRUEBA] Limpieza y reparación de notebooks',
      'Tomás Vega',
      'Reparaciones',
      'Santiago Centro',
      4.7,
      20000,
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80',
      'Mantención preventiva, limpieza interna y diagnóstico de computadores portátiles.',
      true
    ),
    (
      '[PRUEBA] Reparación de lavadoras',
      'Roberto Díaz',
      'Reparaciones',
      'San Miguel',
      4.8,
      23000,
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80',
      'Diagnóstico y reparación de lavadoras y secadoras de distintas marcas.',
      true
    ),
    (
      '[PRUEBA] Pintura de interiores',
      'Andrés Molina',
      'Hogar',
      'Peñalolén',
      4.7,
      35000,
      'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=80',
      'Pintura de habitaciones y espacios interiores, incluye preparación de muros.',
      true
    ),
    (
      '[PRUEBA] Clases de inglés conversacional',
      'Paula Reyes',
      'Clases',
      'Ñuñoa',
      5.0,
      14000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Clases individuales para practicar conversación y ganar fluidez en inglés.',
      true
    ),
    (
      '[PRUEBA] Clases de guitarra para principiantes',
      'Sebastián León',
      'Clases',
      'La Florida',
      4.9,
      13000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Aprende acordes, ritmo y canciones desde cero con clases personalizadas.',
      true
    ),
    (
      '[PRUEBA] Tutoría de ciencias',
      'Camila Ortiz',
      'Clases',
      'Vitacura',
      4.8,
      15000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Apoyo escolar de biología y química para estudiantes de enseñanza media.',
      true
    ),
    (
      '[PRUEBA] Poda y cuidado de árboles',
      'Patricio Salas',
      'Jardinería',
      'La Reina',
      4.8,
      27000,
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=80',
      'Poda segura, limpieza de ramas y cuidado estacional de árboles y arbustos.',
      true
    ),
    (
      '[PRUEBA] Diseño de huerto urbano',
      'Daniela Pino',
      'Jardinería',
      'Ñuñoa',
      5.0,
      32000,
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=80',
      'Diseño e instalación de huertos urbanos para patios, terrazas y balcones.',
      true
    ),
    (
      '[PRUEBA] Mantención de sistemas de riego',
      'Ignacio Campos',
      'Jardinería',
      'Lo Barnechea',
      4.6,
      21000,
      'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=80',
      'Instalación, reparación y programación de riego automático para jardines.',
      true
    ),
    (
      '[PRUEBA] Fotografía para celebraciones',
      'Antonia Vidal',
      'Eventos',
      'Providencia',
      4.9,
      65000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Cobertura fotográfica de cumpleaños, celebraciones familiares y eventos pequeños.',
      true
    ),
    (
      '[PRUEBA] Banquetería para reuniones',
      'Verónica Tapia',
      'Eventos',
      'Las Condes',
      4.8,
      45000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Cóctel y coffee break para reuniones, con alternativas vegetarianas.',
      true
    ),
    (
      '[PRUEBA] Música y DJ para fiestas',
      'Nicolás Herrera',
      'Eventos',
      'Maipú',
      4.7,
      55000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Música, iluminación y animación para fiestas privadas y celebraciones.',
      true
    ),
    (
      '[PRUEBA] Decoración de cumpleaños',
      'Francisca Soto',
      'Eventos',
      'San Miguel',
      4.9,
      38000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Decoración temática y montaje para cumpleaños infantiles y reuniones familiares.',
      true
    ),
    (
      '[PRUEBA] Arriendo de mobiliario para eventos',
      'Cristóbal Méndez',
      'Eventos',
      'Estación Central',
      4.8,
      40000,
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'Arriendo de mesas, sillas y mobiliario para celebraciones y reuniones.',
      true
    )
) as sample (
  title,
  provider_name,
  category,
  location,
  rating,
  starting_price,
  image_url,
  description,
  is_active
)
where not exists (
  select 1
  from public.services as existing
  where existing.title = sample.title
    and existing.provider_name = sample.provider_name
);
