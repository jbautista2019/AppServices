## Oficios Cerca

MVP en React + Vite conectado opcionalmente con Supabase.

### Configurar Supabase

1. En Supabase, abre **SQL Editor**, crea una consulta nueva y ejecuta `supabase/schema.sql`. Puedes volver a ejecutarlo para aplicar la tabla de categorías, su columna `image_url` y migrar los nombres que ya existen en servicios.
2. Ejecuta también `supabase/seed.sql` desde el **SQL Editor** para cargar categorías y publicaciones de prueba. Puedes volver a ejecutarlo sin duplicar esas filas.
3. Si aún no tienes `.env.local`, copia `.env.example` como `.env.local`.
4. En Supabase ve a **Project Settings > API** y completa:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

5. Reinicia Vite con `npm run dev`.

La portada, la búsqueda y el detalle cargan publicaciones activas desde Supabase. Los nombres de categoría vienen de `public.categories` y sus cantidades se calculan a partir de las publicaciones; la aplicación no incluye servicios demo.

### Crear una cuenta pública

En Supabase, habilita el proveedor **Email** y la opción de permitir nuevos registros en **Authentication > Sign In / Providers**. En **Authentication > URL Configuration > Redirect URLs**, permite `http://localhost:5173/cuenta` (ajusta el puerto si Vite utiliza otro). Desde el header, cualquier visitante puede abrir **Crear cuenta** para registrarse con nombre, correo y contraseña. Si la confirmación por correo está activada, deberá confirmar el mensaje antes de iniciar sesión. Las cuentas públicas no reciben permisos de administración.

### Administrar categorías

1. En **Authentication > Users** de Supabase, crea el usuario que administrará las categorías.
2. Si no definiste una contraseña al crear el usuario, en `/admin/categorias` escribe su correo y pulsa **Enviar enlace para crear contraseña**. Abre el correo y define una contraseña; esta se guarda en Supabase Auth, no en `category_admins`.
3. En **Authentication > URL Configuration > Redirect URLs**, permite `http://localhost:5173/**` para el flujo local (ajusta el puerto si Vite utiliza otro).
4. Copia el UUID del usuario y, en **SQL Editor**, regístralo como administrador:

```sql
insert into public.category_admins (user_id)
values ('UUID-DEL-USUARIO')
on conflict (user_id) do nothing;
```

5. Abre `/admin/categorias` e inicia sesión con el correo y la contraseña de Supabase Auth. Solo los UUID registrados pueden crear, renombrar o eliminar categorías.

La imagen de cada categoría se configura pegando una URL pública en el formulario; Supabase guarda esa URL en `public.categories.image_url`.

Al renombrar una categoría se actualizan también sus servicios. La base de datos impide eliminar categorías que todavía tengan servicios asociados.

### Administrar usuarios

El módulo `/admin/usuarios` crea cuentas de Supabase Auth, actualiza nombre/correo/contraseña y habilita o inhabilita el acceso. Todas las operaciones administrativas pasan por una Edge Function; la clave `service_role` nunca se coloca en el frontend.

Desde la raíz del proyecto, puedes usar Supabase CLI con `npx` sin instalarlo globalmente. Primero inicia sesión y vincula el proyecto con su referencia (el identificador al inicio de la URL `https://<PROJECT_REF>.supabase.co`):

```bash
npx --yes supabase login
npx --yes supabase link --project-ref <PROJECT_REF>
npx --yes supabase functions deploy admin-users
```

`supabase login` solicita un access token de tu cuenta Supabase. Pégalo directamente en la terminal, no en el código ni en el chat. `supabase link` puede solicitar la contraseña de la base de datos; introdúcela solo en la terminal.

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Edge Functions de Supabase. Solo usuarios cuyo UUID esté en `public.category_admins` pueden acceder. Las cuentas administradoras no se pueden inhabilitar desde este módulo.

### Comandos

```bash
npm install
npm run dev
npm run build
```
