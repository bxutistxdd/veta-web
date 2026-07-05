-- VETA · Gestor de despachos en #admin
-- Ejecutar en Supabase SQL Editor (o via conexión PG directa):
-- https://supabase.com/dashboard/project/ojixjsrzpgpxaikuqffk/sql/new
--
-- Habilita que el admin logueado pueda actualizar el estado de cada pedido
-- (pending → dispatched → delivered) desde la pestaña Despachos.

-- SELECT ya existe de veta-chat-admin.sql; se recrea de forma idempotente.
drop policy if exists "admin read wa_orders" on wa_orders;
create policy "admin read wa_orders"
  on wa_orders for select
  using (auth.role() = 'authenticated');

-- UPDATE: el admin puede cambiar el campo status (y solo status).
drop policy if exists "admin update wa_orders" on wa_orders;
create policy "admin update wa_orders"
  on wa_orders for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- Registro manual de pedidos (venta cerrada por un asesor)
-- ─────────────────────────────────────────────
-- source distingue el origen del pedido: 'bot' (Luna lo detectó y cerró),
-- 'auto-pausado' (Luna lo detectó mientras el asesor tenía el control del
-- chat) o 'manual' (el asesor lo registró a mano desde #admin).
alter table wa_orders add column if not exists source text default 'bot';

-- INSERT: el admin autenticado puede registrar un pedido cerrado a mano
-- (además del service_role de n8n, que ya insertaba sin pasar por RLS).
drop policy if exists "admin insert wa_orders" on wa_orders;
create policy "admin insert wa_orders"
  on wa_orders for insert
  to authenticated
  with check (auth.role() = 'authenticated');
