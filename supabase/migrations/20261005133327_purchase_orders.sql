-- Purchase orders for replacement instruments: Sterilization picks damaged, serviced, lost or
-- out-of-use instruments and records an order to buy new ones. One row per order; its lines (code,
-- name, quantity and the instruments they replace) are kept as JSON.
create table if not exists public.purchase_orders (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
  number text,
  status text,
  supplier text,
  note text,
  lines jsonb,
  created_on text,
  created_by_name text,
  ordered_on text,
  received_on text,
  cancelled_on text,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (organization_id, id)
);

create index if not exists purchase_orders_org_created_idx on public.purchase_orders (organization_id, created_at desc);
create index if not exists purchase_orders_updated_by_idx on public.purchase_orders (updated_by);

alter table public.purchase_orders enable row level security;

create policy purchase_orders_read on public.purchase_orders for select to authenticated
  using (organization_id = public.current_org_id() or public.is_platform_admin());

create policy purchase_orders_insert on public.purchase_orders for insert to authenticated
  with check ((organization_id = public.current_org_id() or public.is_platform_admin())
    and public.app_record_writable('purchaseOrders'));

create policy viewer_no_insert on public.purchase_orders as restrictive for insert to authenticated
  with check (not public.is_viewer());

create policy purchase_orders_update on public.purchase_orders for update to authenticated
  using ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('purchaseOrders'))
  with check ((organization_id = public.current_org_id() or public.is_platform_admin()) and public.app_record_writable('purchaseOrders'));

create policy viewer_no_update on public.purchase_orders as restrictive for update to authenticated
  using (not public.is_viewer());

create policy trial_lock on public.purchase_orders as restrictive for all to authenticated
  using (public.is_platform_admin() or not (select public.current_org_locked()))
  with check (public.is_platform_admin() or not (select public.current_org_locked()));

create trigger purchase_orders_touch before update on public.purchase_orders
  for each row execute function public.touch_updated_row();

revoke all on public.purchase_orders from anon;
grant select, insert, update on public.purchase_orders to authenticated;
