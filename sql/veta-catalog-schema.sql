-- VETA · Esquema del catálogo (products, stock, settings)
-- Documenta y versiona lo que YA existe en producción (Supabase). Idempotente:
-- seguro de re-ejecutar. RLS: lectura pública (anon SELECT) para mostrar el
-- catálogo sin sesión; escritura solo para el admin (authenticated) y el bot
-- (service_role). Esto cierra cualquier escritura anónima.

-- ─────────────────────────────────────────────
-- products
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          TEXT        PRIMARY KEY,                 -- ej: an-01
  name        TEXT        NOT NULL,
  cat         TEXT        NOT NULL,                    -- anillos|collares|aretes|pulseras|piercings
  material    TEXT        NOT NULL,
  finish      TEXT        NOT NULL,
  price       INTEGER     NOT NULL,                    -- COP
  sizes       JSONB       NOT NULL DEFAULT '[]',
  blurb       TEXT,
  description TEXT,
  images      JSONB,                                   -- {main,profile,detail,context}
  visible     BOOLEAN     NOT NULL DEFAULT TRUE,
  featured    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_public_read"   ON products;
CREATE POLICY "products_public_read"   ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "products_auth_write"    ON products;
CREATE POLICY "products_auth_write"    ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_service_write" ON products;
CREATE POLICY "products_service_write" ON products FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- stock  (PK compuesto product_id + size)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock (
  product_id TEXT        NOT NULL,
  size       TEXT        NOT NULL,
  qty        INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, size)
);
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_public_read"   ON stock;
CREATE POLICY "stock_public_read"   ON stock FOR SELECT USING (true);
DROP POLICY IF EXISTS "stock_auth_write"    ON stock;
CREATE POLICY "stock_auth_write"    ON stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stock_service_write" ON stock;
CREATE POLICY "stock_service_write" ON stock FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- settings  (clave/valor: wa_phone, bot_daily_limit, featured_mode, ...)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_public_read"   ON settings;
CREATE POLICY "settings_public_read"   ON settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "settings_auth_write"    ON settings;
CREATE POLICY "settings_auth_write"    ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "settings_service_write" ON settings;
CREATE POLICY "settings_service_write" ON settings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
