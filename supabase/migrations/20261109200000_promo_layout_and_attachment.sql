-- A promotion can say where its picture goes on the card (top, left, right) and carry a file (a PDF), stored in the
-- same public bucket as the pictures. The bucket now takes PDFs, up to 10 MB.
alter table public.platform_notices
  add column if not exists image_layout text,
  add column if not exists attachment_url text,
  add column if not exists attachment_name text;

alter table public.platform_notices drop constraint if exists platform_notices_image_layout_check;
alter table public.platform_notices add constraint platform_notices_image_layout_check
  check (image_layout is null or image_layout in ('TOP', 'LEFT', 'RIGHT'));
alter table public.platform_notices drop constraint if exists platform_notices_attachment_check;
alter table public.platform_notices add constraint platform_notices_attachment_check
  check (
    attachment_url is null
    or (attachment_url ~* '^https://[^[:space:]]+$' and length(attachment_url) <= 500)
  );
alter table public.platform_notices drop constraint if exists platform_notices_attachment_name_check;
alter table public.platform_notices add constraint platform_notices_attachment_name_check
  check (attachment_name is null or length(btrim(attachment_name)) between 1 and 200);

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'promo-images';
