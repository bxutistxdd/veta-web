-- VETA · Categorías jerárquicas (Categoría → Subcategoría → Referencia)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Profundidad fija de 3 niveles. Tabla autoreferenciada.

create table if not exists public.categories (
  id         text primary key,                                   -- slug, p.ej. "anillos-plata"
  parent_id  text references public.categories(id) on delete cascade,
  level      int  not null check (level between 1 and 3),        -- 1=categoria 2=subcategoria 3=referencia
  label      text not null,
  blurb      text default '',
  prefix     text,                                               -- prefijo de ID de producto (solo nivel 1), p.ej. "an"
  sort       int  default 0,
  created_at timestamptz default now()
);

create index if not exists categories_parent_idx on public.categories(parent_id);
create index if not exists categories_level_idx  on public.categories(level);

-- Lectura pública; escritura solo authenticated (espejo de las políticas de products).
alter table public.categories enable row level security;

drop policy if exists "cat_read"  on public.categories;
drop policy if exists "cat_write" on public.categories;
create policy "cat_read"  on public.categories for select using (true);
create policy "cat_write" on public.categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Seed: las 5 categorías actuales (preserva los product.cat existentes).
insert into public.categories (id, parent_id, level, label, blurb, prefix, sort) values
  ('anillos',   null, 1, 'Anillos',   'Banda, sello, doble. Pieza única o stackable.',  'an', 1),
  ('collares',  null, 1, 'Collares',  'De cadena fina a filigrana momposina.',          'co', 2),
  ('aretes',    null, 1, 'Aretes',    'Topo, aro, caída. Cierre seguro de presión.',    'ar', 3),
  ('pulseras',  null, 1, 'Pulseras',  'Trenzadas, eslabón, hilo o brazalete abierto.',  'pu', 4),
  ('piercings', null, 1, 'Piercings', 'Grado quirúrgico. Rosca interna.',               'pi', 5)
on conflict (id) do nothing;

-- Columnas nuevas en products (opcionales, retrocompatibles).
alter table public.products
  add column if not exists subcat text references public.categories(id) on delete set null;
alter table public.products
  add column if not exists "ref" text references public.categories(id) on delete set null;

-- Realtime para que el panel y la tienda reflejen cambios en vivo.
alter publication supabase_realtime add table public.categories;
