-- VETA · Buzón de chats en #admin
-- Ejecutar en Supabase SQL Editor (o vía conexión PG directa):
-- https://supabase.com/dashboard/project/ojixjsrzpgpxaikuqffk/sql/new
--
-- Habilita que el panel admin (rol authenticated) lea las conversaciones de
-- WhatsApp en tiempo real, responda como asesor (role 'agent') y tome control
-- del chat (pausar la IA por cliente). El bot (service_role) sigue con acceso
-- total y además escala (needs_human) cuando se requiere intervención humana.

-- ─────────────────────────────────────────────
-- 1. Estado por conversación (no es un mensaje)
-- ─────────────────────────────────────────────
create table if not exists wa_threads (
  phone         text        primary key,         -- número del cliente (ej: 573001234567)
  customer_name text,                              -- nombre si el bot lo conoce
  bot_paused    boolean     default false,         -- true = un humano tomó control; la IA no responde
  needs_human   boolean     default false,         -- true = el bot escaló: requiere asesor
  last_at       timestamptz default now(),         -- último mensaje (para ordenar la lista)
  updated_at    timestamptz default now()
);

create index if not exists idx_wa_threads_last on wa_threads (last_at desc);

-- ─────────────────────────────────────────────
-- 2. Row Level Security
--    El bot usa service_role (acceso total, ya cubierto por políticas previas).
--    El admin usa el rol authenticated: lectura de chats/pedidos/threads +
--    control de la pausa. La escritura de mensajes 'agent' la hace el relay de
--    n8n con service_role, no el navegador.
-- ─────────────────────────────────────────────
alter table wa_threads enable row level security;

-- service_role: acceso total a wa_threads
drop policy if exists "service role full access wa_threads" on wa_threads;
create policy "service role full access wa_threads"
  on wa_threads for all
  using (auth.role() = 'service_role');

-- authenticated: leer threads, conversaciones y pedidos
drop policy if exists "admin read wa_threads" on wa_threads;
create policy "admin read wa_threads"
  on wa_threads for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin read wa_conversations" on wa_conversations;
create policy "admin read wa_conversations"
  on wa_conversations for select
  using (auth.role() = 'authenticated');

drop policy if exists "admin read wa_orders" on wa_orders;
create policy "admin read wa_orders"
  on wa_orders for select
  using (auth.role() = 'authenticated');

-- authenticated: tomar/devolver control y limpiar el flag de escalamiento.
-- (UPDATE + INSERT por si el thread aún no existe cuando el admin lo abre.)
drop policy if exists "admin update wa_threads" on wa_threads;
create policy "admin update wa_threads"
  on wa_threads for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "admin insert wa_threads" on wa_threads;
create policy "admin insert wa_threads"
  on wa_threads for insert
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- 3. Realtime (respeta RLS: por eso las políticas SELECT de arriba)
-- ─────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table wa_conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table wa_threads;
  exception when duplicate_object then null;
  end;
end $$;
