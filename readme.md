## Oficios Cerca

MVP en React + Vite conectado opcionalmente con Supabase.

### Configurar Supabase

1. En Supabase, abre **SQL Editor**, crea una consulta nueva y pega el contenido de `supabase/schema.sql`.
2. Ejecuta también `supabase/seed.sql` desde el **SQL Editor** para cargar publicaciones de prueba. Puedes volver a ejecutarlo sin duplicar esas filas.
3. Si aún no tienes `.env.local`, copia `.env.example` como `.env.local`.
4. En Supabase ve a **Project Settings > API** y completa:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

5. Reinicia Vite con `npm run dev`.

La portada, la búsqueda y el detalle cargan publicaciones activas desde Supabase. Las categorías y sus cantidades se derivan de esas publicaciones; la aplicación no incluye servicios demo. Sin configuración o sin publicaciones activas, verás los estados vacíos correspondientes.

### Comandos

```bash
npm install
npm run dev
npm run build
```
