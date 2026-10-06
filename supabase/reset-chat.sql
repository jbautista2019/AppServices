-- ADVERTENCIA: borra TODAS las conversaciones y mensajes de TODOS los usuarios. No se puede deshacer.
-- Ejecutar en Supabase > SQL Editor. No toca servicios, categorías ni usuarios.
-- messages y conversation_hidden se eliminan en cascada junto con conversations.

begin;

delete from public.conversations;

commit;

-- Verificación (las tres deben dar 0):
select
  (select count(*) from public.conversations)       as conversaciones,
  (select count(*) from public.messages)            as mensajes,
  (select count(*) from public.conversation_hidden) as ocultas;
