-- A promotion can show a picture of the product: an https address, shown on the card of the hospital administrator.
alter table public.platform_notices
  add column if not exists image_url text;

alter table public.platform_notices
  add constraint platform_notices_image_check
    check (image_url is null or (image_url ~* '^https://[^[:space:]]+$' and length(image_url) <= 500));
