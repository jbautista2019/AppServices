-- Datos dummy para probar la UI de publicaciones
-- Ejecuta este archivo en el SQL editor de Supabase.

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
  is_active,
  created_at
)
select * from (
  values
    (
      'Plomería a domicilio',
      'María López',
      'Hogar',
      'Santiago Centro',
      4.8,
      18000,
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
      'Reparación de fugas, cambio de grifería y soluciones rápidas para instalaciones sanitarias.',
      true,
      now()
    ),
    (
      'Limpieza profunda de departamentos',
      'Ana García',
      'Hogar',
      'Providencia',
      4.9,
      22000,
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
      'Aseo completo de cocina, baño, dormitorios y áreas comunes con productos profesionales.',
      true,
      now()
    ),
    (
      'Mantenimiento de jardines',
      'Carlos Rojas',
      'Jardinería',
      'Las Condes',
      4.7,
      25000,
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80',
      'Poda, fertilización y asesoría para mantener tu jardín saludable durante todo el año.',
      true,
      now()
    ),
    (
      'Electricista residencial',
      'Pablo Silva',
      'Hogar',
      'La Florida',
      4.8,
      21000,
      'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80',
      'Instalación de luminarias, revisión de cortocircuitos y trabajos eléctricos del hogar.',
      true,
      now()
    ),
    (
      'Armado de muebles',
      'Diego Vargas',
      'Hogar',
      'Maipú',
      4.6,
      17000,
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
      'Montaje y nivelación de muebles para dormitorio, cocina, oficina y sala de estar.',
      true,
      now()
    ),
    (
      'Pintura interior',
      'Felipe Moreno',
      'Hogar',
      'Puente Alto',
      4.9,
      32000,
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
      'Pintura de paredes, reparación de muros y acabados para renovar espacios interiores.',
      true,
      now()
    ),
    (
      'Manicura y nail art',
      'Valentina Mena',
      'Belleza',
      'Ñuñoa',
      5.0,
      15000,
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
      'Manicura y diseños personalizados para eventos, fiestas y cuidado diario.',
      true,
      now()
    ),
    (
      'Maquillaje para eventos',
      'Renata Cruz',
      'Belleza',
      'La Reina',
      4.9,
      28000,
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
      'Maquillaje social y de noche para bodas, reuniones y celebraciones especiales.',
      true,
      now()
    ),
    (
      'Corte y color profesional',
      'Camila Díaz',
      'Belleza',
      'Macul',
      4.8,
      24000,
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
      'Corte, tinte y asesoría de color para un look moderno y personalizado.',
      true,
      now()
    ),
    (
      'Depilación corporal',
      'Francisca Vega',
      'Belleza',
      'San Miguel',
      4.7,
      16000,
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
      'Servicio de depilación con atención personalizada y productos seguros para la piel.',
      true,
      now()
    ),
    (
      'Reparación de computadores',
      'José Álvarez',
      'Reparaciones',
      'Santiago Centro',
      4.9,
      21000,
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
      'Revisión, mantenimiento y reparación de PC y notebooks con diagnóstico profesional.',
      true,
      now()
    ),
    (
      'Reparación de lavadoras',
      'Ricardo Gómez',
      'Reparaciones',
      'Quilicura',
      4.8,
      23000,
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
      'Diagnóstico y arreglo de lavadoras y secadoras de distintas marcas y modelos.',
      true,
      now()
    ),
    (
      'Soporte técnico hogar',
      'Nicolás Torres',
      'Reparaciones',
      'La Florida',
      4.7,
      19000,
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
      'Instalación de redes, impresoras y equipos domésticos con soporte local y rápido.',
      true,
      now()
    ),
    (
      'Clases de matemáticas',
      'Andrea Ruiz',
      'Clases',
      'Providencia',
      4.9,
      12000,
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80',
      'Preparación escolar, reforzamiento y apoyo en contenidos de matemática básica y media.',
      true,
      now()
    ),
    (
      'Clases de inglés',
      'Daniela Pérez',
      'Clases',
      'Ñuñoa',
      5.0,
      14000,
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80',
      'Clases particulares para conversación, gramática y preparación de exámenes.',
      true,
      now()
    ),
    (
      'Tutoría de ciencias',
      'Esteban Reyes',
      'Clases',
      'Vitacura',
      4.8,
      15000,
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=80',
      'Apoyo en biología, química y física para estudiantes de enseñanza media.',
      true,
      now()
    ),
    (
      'Clases de guitarra',
      'Sebastián León',
      'Clases',
      'La Florida',
      4.9,
      13000,
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80',
      'Aprender guitarra desde cero, técnicas básicas y acompañamiento con canciones populares.',
      true,
      now()
    ),
    (
      'Diseño de jardines',
      'Patricia Castro',
      'Jardinería',
      'Peñalolén',
      4.8,
      26000,
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80',
      'Diseños modernos para jardines pequeños, jardineras y áreas exteriores familiares.',
      true,
      now()
    ),
    (
      'Podas y desmalezado',
      'Miguel Salazar',
      'Jardinería',
      'San Bernardo',
      4.7,
      20000,
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80',
      'Servicio de poda ornamental y limpieza de áreas verdes para mantener espacios ordenados.',
      true,
      now()
    ),
    (
      'Decoración de eventos',
      'Karina Díaz',
      'Eventos',
      'Las Condes',
      4.9,
      50000,
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80',
      'Organización y decoración para cumpleaños, reuniones y eventos sociales con estilo.',
      true,
      now()
    ),
    (
      'Catering para eventos',
      'Luis Vera',
      'Eventos',
      'Lo Barnechea',
      5.0,
      65000,
      'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80',
      'Menú para fiestas, reuniones empresariales y celebraciones con servicio completo.',
      true,
      now()
    ),
    (
      'Sonido para eventos',
      'Gabriel Figueroa',
      'Eventos',
      'Santiago Centro',
      4.8,
      45000,
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80',
      'Equipos de audio, iluminación y soporte técnico para eventos pequeños y grandes.',
      true,
      now()
    ),
    (
      'Planificación de fiestas',
      'Marina Navarro',
      'Eventos',
      'Conchalí',
      4.9,
      38000,
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80',
      'Coordinación integral para fiestas infantiles, reuniones familiares y celebraciones.',
      true,
      now()
    )
) as v(title, provider_name, category, location, rating, starting_price, image_url, description, is_active, created_at)
where not exists (
  select 1
  from public.services s
  where s.title = v.title
    and s.provider_name = v.provider_name
    and s.category = v.category
    and s.location = v.location
    and s.description = v.description
);
