## Oficios Cerca

MVP en React + Vite conectado opcionalmente con Supabase.

### Configurar Supabase

1. En Supabase, abre **SQL Editor**, crea una consulta nueva y pega el contenido de `supabase/schema.sql`.
2. Copia `.env.example` como `.env.local`.
3. En Supabase ve a **Project Settings > API** y completa:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

4. Reinicia Vite con `npm run dev`.

La pantalla de búsqueda consulta los servicios activos de Supabase. Si aún no existe `.env.local`, la aplicación usa datos demo para que el frontend siga siendo navegable.

### Comandos

```bash
npm install
npm run dev
npm run build
```
