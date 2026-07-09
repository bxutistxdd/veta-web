-- Ejecutar en Supabase SQL Editor
-- https://supabase.com/dashboard/project/ojixjsrzpgpxaikuqffk/sql/new

-- ─────────────────────────────────────────────
-- 1. Historial de conversaciones de WhatsApp
-- ─────────────────────────────────────────────
create table if not exists wa_conversations (
  id          uuid        default gen_random_uuid() primary key,
  phone       text        not null,          -- número del cliente (ej: 573001234567)
  role        text        not null,          -- 'user' o 'assistant'
  content     text        not null,
  created_at  timestamptz default now()
);

-- Índice para consultar rápido por teléfono
create index if not exists idx_wa_conv_phone on wa_conversations (phone, created_at desc);

-- ─────────────────────────────────────────────
-- 2. Pedidos recibidos por WhatsApp
-- ─────────────────────────────────────────────
create table if not exists wa_orders (
  id            uuid        default gen_random_uuid() primary key,
  phone         text        not null,
  customer_name text,
  city          text,
  items         text        not null,         -- texto como "Anillo Vena(talla 7)x1, Aretes Sol(14mm)x1"
  notes         text,
  status        text        default 'pending', -- pending | confirmed | shipped | done
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 3. Row Level Security
-- ─────────────────────────────────────────────
alter table wa_conversations enable row level security;
alter table wa_orders enable row level security;

-- Solo el service role puede leer y escribir
create policy "service role full access wa_conversations"
  on wa_conversations for all
  using (auth.role() = 'service_role');

create policy "service role full access wa_orders"
  on wa_orders for all
  using (auth.role() = 'service_role');
