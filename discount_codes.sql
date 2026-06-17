-- VETA · Tabla de códigos de descuento
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS discount_codes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  code          TEXT        UNIQUE NOT NULL,
  description   TEXT        DEFAULT '',
  type          TEXT        DEFAULT 'percent' CHECK (type IN ('percent', 'fixed')),
  value         NUMERIC     NOT NULL CHECK (value > 0),
  min_subtotal  NUMERIC     DEFAULT 0,
  max_uses      INTEGER     DEFAULT NULL,
  uses_count    INTEGER     DEFAULT 0,
  active        BOOLEAN     DEFAULT TRUE,
  show_on_site  BOOLEAN     DEFAULT FALSE,
  expires_at    TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede leer los códigos activos (para validarlos en el carrito)
CREATE POLICY "public_read_active_discounts" ON discount_codes
  FOR SELECT TO anon USING (active = true);

-- El admin (autenticado) puede hacer todo
CREATE POLICY "admin_all_discounts" ON discount_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Función RPC para que anon incremente uses_count de forma segura
CREATE OR REPLACE FUNCTION increment_discount_code_use(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE discount_codes
  SET uses_count = uses_count + 1
  WHERE code = p_code AND active = TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_discount_code_use(TEXT) TO anon;

-- Código de ejemplo
INSERT INTO discount_codes (code, description, type, value, active, show_on_site)
VALUES ('VETAINAUGURACIÓN', '25% de descuento por inauguración', 'percent', 25, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;
