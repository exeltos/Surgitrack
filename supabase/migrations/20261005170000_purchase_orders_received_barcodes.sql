-- The new instruments an order put into Stock when it arrived.
alter table public.purchase_orders add column if not exists received_barcodes text[];
