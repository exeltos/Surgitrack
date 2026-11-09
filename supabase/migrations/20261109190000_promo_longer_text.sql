-- A promotion has room for a paragraph (up to 1000 characters); an announcement stays one line (300).
alter table public.platform_notices drop constraint if exists platform_notices_message_check;
alter table public.platform_notices add constraint platform_notices_message_check
  check (length(btrim(message)) between 1 and (case when kind = 'PROMO' then 1000 else 300 end));
