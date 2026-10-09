-- A maintenance notice the platform owner writes in Studio → Settings ("Maintenance Sunday 22:00–23:00"),
-- shown to every signed-in user until the time given. platform_settings is already readable by everyone
-- signed in and changed only by the platform owner.
alter table public.platform_settings
  add column if not exists maintenance_message text check (length(maintenance_message) <= 300),
  add column if not exists maintenance_until timestamptz;
