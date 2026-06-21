-- VETA · Tabla de cotizaciones del carrito (web → WhatsApp)
-- Ejecutar en Supabase → SQL Editor (o vía conexión PG directa). Idempotente.
--
-- La web genera un código corto (6 caracteres, ver genQuoteCode en js/db.js) y,
-- en paralelo a abrir wa.me, guarda aquí el detalle del carrito (solo INSERT).
-- El agente de WhatsApp (n8n, service_role) resuelve ese código para conocer
-- items/total/descuento del pedido; el admin (#admin) lo consulta autenticado.
--
-- NOTA DE SEGURIDAD: la versión previa en producción tenía una policy
-- "anon select quotes" con USING (true), que permitía a cualquiera con la anon
-- key leer TODOS los carritos (items, totales, códigos de descuento de todos los
-- clientes). La web nunca lee con anon (solo saveCartQuote → INSERT), así que esa
-- policy se elimina aquí. anon solo puede insertar.

CREATE TABLE IF NOT EXISTS cart_quotes (
  code            TEXT        PRIMARY KEY,           -- código corto único (ej: A7B2K9)
  items           JSONB       NOT NULL DEFAULT '[]', -- [{id,name,material,finish,size,qty,price}]
  subtotal        NUMERIC     NOT NULL DEFAULT 0,
  discount_code   TEXT        DEFAULT NULL,
  discount_amount NUMERIC     NOT NULL DEFAULT 0,
  total           NUMERIC     NOT NULL DEFAULT 0,
  used            BOOLEAN     NOT NULL DEFAULT FALSE,-- el bot la marca al resolver el pedido
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_quotes_created ON cart_quotes (created_at DESC);

ALTER TABLE cart_quotes ENABLE ROW LEVEL SECURITY;

-- ❌ Eliminar la lectura anónima (fuga de privacidad). Cubre los nombres usados
--    históricamente en este proyecto.
DROP POLICY IF EXISTS "anon select quotes"        ON cart_quotes;
DROP POLICY IF EXISTS "anon_select_cart_quotes"   ON cart_quotes;

-- ✅ anon puede crear cotizaciones (insert), sin leer.
DROP POLICY IF EXISTS "anon insert quotes" ON cart_quotes;
CREATE POLICY "anon insert quotes" ON cart_quotes
  FOR INSERT TO anon WITH CHECK (true);

-- ✅ admin autenticado: lectura y gestión completa.
DROP POLICY IF EXISTS "authenticated all quotes" ON cart_quotes;
CREATE POLICY "authenticated all quotes" ON cart_quotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- (service_role — el bot de n8n — omite RLS por diseño en Supabase, no requiere policy.)
