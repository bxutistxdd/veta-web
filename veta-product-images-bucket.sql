-- VETA · Bucket de Storage para imágenes de producto (subida nativa)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Espejo del bucket existente `wa-media`: lectura pública, escritura authenticated.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "prodimg_read"  on storage.objects;
drop policy if exists "prodimg_write" on storage.objects;

create policy "prodimg_read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "prodimg_write" on storage.objects
  for all
  using      (bucket_id = 'product-images' and auth.role() = 'authenticated')
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
