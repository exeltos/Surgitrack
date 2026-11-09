-- The pictures of promotions: a public bucket (every hospital's administrator sees the card), written only by the
-- platform owner. Public reading needs no policy; the pictures are small JPEG/PNG/WebP files.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('promo-images', 'promo-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists promo_images_owner_insert on storage.objects;
create policy promo_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'promo-images' and (select public.is_platform_admin()));

drop policy if exists promo_images_owner_delete on storage.objects;
create policy promo_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'promo-images' and (select public.is_platform_admin()));
