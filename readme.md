## Oficios Cerca

MVP en React + Vite conectado opcionalmente con Supabase.

### Configurar Supabase

1. En Supabase, abre **SQL Editor**, crea una consulta nueva y ejecuta `supabase/schema.sql`. Puedes volver a ejecutarlo para aplicar la tabla de categorías, su columna `image_url`, migrar los nombres existentes y crear las tablas/políticas del chat.
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

En Supabase, habilita el proveedor **Email** y la opción de permitir nuevos registros en **Authentication > Sign In / Providers**. En **Authentication > URL Configuration > Redirect URLs**, permite `http://localhost:5173/cuenta` (ajusta el puerto si Vite utiliza otro). Desde el header, cualquier visitante puede abrir **Crear cuenta** para registrarse con nombre, correo y contraseña, o continuar con Google.

Para habilitar Google, configura un cliente OAuth en Google Cloud y agrega como URI de redirección autorizada `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. Luego ingresa el Client ID y Client Secret en **Supabase > Authentication > Sign In / Providers > Google** y habilita el proveedor. Mantén `http://localhost:5173/cuenta` en las Redirect URLs de Supabase para el retorno a la aplicación local. En producción, agrega también la URL pública correspondiente. Las cuentas públicas no reciben permisos de administración.

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

### Búsqueda híbrida (texto + semántica)

El buscador combina coincidencia de texto (sin tildes, con tolerancia a errores de tipeo y sinónimos chilenos como plomero → gasfíter) con búsqueda semántica por embeddings (modelo `gte-small`, 384 dimensiones). Las búsquedas cortas ("Maipú", "gasfíter") priorizan el texto y las frases largas ("me gotea el techo") priorizan la semántica; una coincidencia exacta siempre queda primero. Si el servicio no está disponible, la búsqueda cae a coincidencia de texto simple en el navegador.

1. Ejecuta `supabase/semantic-search.sql` en el **SQL Editor** (activa `vector`, `unaccent` y `pg_trgm`, agrega `services.embedding`, la tabla de sinónimos y la función `search_services`).
2. Despliega la Edge Function. Con Supabase CLI (vía `npx`, sin instalarlo), inicia sesión y vincula el proyecto con su referencia (el identificador al inicio de la URL `https://<PROJECT_REF>.supabase.co`); el token y la contraseña de la base de datos se pegan solo en la terminal:

```bash
npx --yes supabase login
npx --yes supabase link --project-ref <PROJECT_REF>
npx --yes supabase functions deploy semantic-search
```

3. No hay que cargar nada a mano: la función calcula los embeddings de los servicios que todavía no los tienen (8 por búsqueda) y se recalculan al crear o editar un servicio.

Para ampliar el vocabulario agrega filas a `public.search_synonyms` (`term` es la cabeza del grupo y `synonym` cada palabra equivalente, en minúsculas y sin tildes). Los umbrales se ajustan al inicio de `search_services` (`p_min_similarity`, `semantic_margin`, pesos de texto/semántica).

### Orden de los scripts SQL

Todos son idempotentes y se ejecutan en **SQL Editor**. El orden importa porque unos dependen de las tablas de otros:

1. `supabase/schema.sql` (servicios, categorías, chat y `category_admins`)
2. `supabase/seed.sql` (datos de prueba, opcional)
3. `supabase/service-modality.sql`, `supabase/communes.sql`, `supabase/storage-service-images.sql`, `supabase/service-gallery.sql`, `supabase/provider-profiles.sql`
4. `supabase/chat-upgrade.sql` (eliminar conversaciones; usa las tablas del chat)
5. `supabase/reviews.sql` (valoraciones; usa `conversations` y `messages`)
6. `supabase/user-notifications.sql` (notificaciones de la plataforma)
7. `supabase/service-reports.sql` (reportes y moderación; usa `user_notifications` y `category_admins`)
8. `supabase/semantic-search.sql` (búsqueda híbrida, opcional)

### Lista de prueba del flujo completo

Necesitas dos cuentas con sesión, **A** (profesional) y **B** (cliente), y una cuenta **admin** registrada en `category_admins`. Úsalas en ventanas separadas.

| # | Quién | Acción | Resultado esperado |
|---|---|---|---|
| 1 | A | Crear una publicación | Aparece en la portada y en «Mis servicios» como *Publicado* |
| 2 | A | Editar el título | El cambio se ve en el detalle |
| 3 | A | Pausar la publicación | Pasa a *Pausado* y B ya no la encuentra en la búsqueda |
| 4 | A | Reactivar | Vuelve a verse |
| 5 | B | Abrir el detalle y pulsar **Contactar** | Se abre el chat con A; A recibe la notificación en la campana |
| 6 | A | En el chat pulsar **Solicitar valoración** | B recibe un mensaje con el enlace `/valorar/…` |
| 7 | B | Abrir el enlace, dar estrellas y comentario | A ve la valoración (con el comentario y quién la dejó) en Perfil > Valoraciones |
| 8 | B | Abrir de nuevo el enlace | Dice que ya valoró; «Ver el servicio» aparece solo si la publicación está activa |
| 9 | B | Reportar la publicación de A | Mensaje de agradecimiento; un segundo reporte da «Ya reportaste…» |
| 10 | A | Intentar reportar su propia publicación | El botón no aparece |
| 11 | admin | Mirar la campana | Aparece «1 publicación reportada» en rojo |
| 12 | admin | Abrir **Reportes de publicaciones** | Un grupo con la publicación y el reporte de B |
| 13 | admin | **Ocultar publicación** | A recibe la notificación «Ocultamos tu publicación»; en «Mis servicios» figura *Oculto por moderación* y no puede reanudarla |
| 14 | admin | **Marcar revisado** | B recibe la notificación «Revisamos tu reporte»; el aviso del admin desaparece |
| 15 | admin | **Mostrar publicación** | A recibe «volvió a estar visible» y puede pausar/reactivar de nuevo |
| 16 | A | Eliminar la publicación | El reporte sigue en la pantalla del admin como «Eliminada por su dueño» |
| 17 | usuario sin permisos | Abrir `/admin/reportes` | «Esta cuenta no tiene permiso» |

### Estructura del frontend

```text
src/
	app/          Rutas y carga global de datos
	components/   Componentes reutilizables
	pages/        Páginas agrupadas por módulo
	styles/       Estilos globales, administrativos y de conexión
	utils/        Cliente y funciones de Supabase
```

### Comandos

```bash
npm install
npm run dev
npm run build
```
