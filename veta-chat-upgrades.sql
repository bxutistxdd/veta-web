-- VETA · Mejoras del buzón de chats (orden, reply/quote, imágenes)
-- Ejecutar ANTES de desplegar el flujo n8n nuevo (el flujo escribe estas columnas).
-- Aplicar con:  ! node apply-chat-upgrades.js
--
-- 1) Columnas nuevas en wa_conversations para soportar:
--    - wa_mid    : id del mensaje en WhatsApp (wamid). Permite resolver respuestas.
--    - reply_to  : wamid al que responde este mensaje (cita / reply).
--    - msg_type  : 'text' | 'image' (tipo de contenido de la burbuja).
--    - media_url : URL pública en Storage cuando es imagen.
--    El orden de las burbujas se arregla guardando el created_at real del cliente
--    (timestamp de WhatsApp) desde n8n; aquí no hace falta cambiar created_at.

alter table wa_conversations add column if not exists wa_mid    text;
alter table wa_conversations add column if not exists reply_to  text;
alter table wa_conversations add column if not exists msg_type  text default 'text';
alter table wa_conversations add column if not exists media_url  text;

create index if not exists idx_wa_conv_mid on wa_conversations (wa_mid);

-- ─────────────────────────────────────────────
-- 2) Bucket de Storage para imágenes de WhatsApp
--    Público en lectura (las <img> del panel cargan sin token).
--    El bot sube con service_role (bypassa RLS). El admin sube con rol
--    authenticated (política de INSERT abajo).
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('wa-media', 'wa-media', true)
on conflict (id) do update set public = true;

-- Lectura pública del bucket
drop policy if exists "wa_media public read" on storage.objects;
create policy "wa_media public read"
  on storage.objects for select
  using (bucket_id = 'wa-media');

-- Subida por el admin logueado (rol authenticated)
drop policy if exists "wa_media admin upload" on storage.objects;
create policy "wa_media admin upload"
  on storage.objects for insert
  with check (bucket_id = 'wa-media' and auth.role() = 'authenticated');

-- Sobrescritura por el admin (upsert al reintentar una subida)
drop policy if exists "wa_media admin update" on storage.objects;
create policy "wa_media admin update"
  on storage.objects for update
  using (bucket_id = 'wa-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'wa-media' and auth.role() = 'authenticated');
