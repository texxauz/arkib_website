-- Checklist items (opening / closing procedures)
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('opening', 'closing')),
  text text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Checklist submission logs
create table if not exists public.checklist_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('opening', 'closing')),
  user_id uuid not null references auth.users(id),
  user_name text not null,
  submitted_at timestamptz not null default now(),
  notes text,
  items_checked text[] not null default '{}',
  total_items integer not null default 0
);

-- RLS
alter table public.checklist_items enable row level security;
alter table public.checklist_logs enable row level security;

create policy "Authenticated users can read checklist_items"
  on public.checklist_items for select to authenticated using (true);
create policy "Admins can insert checklist_items"
  on public.checklist_items for insert to authenticated with check (true);
create policy "Admins can update checklist_items"
  on public.checklist_items for update to authenticated using (true);

create policy "Authenticated users can read checklist_logs"
  on public.checklist_logs for select to authenticated using (true);
create policy "Authenticated users can insert checklist_logs"
  on public.checklist_logs for insert to authenticated with check (true);

-- Seed opening items
insert into public.checklist_items (type, text, sort_order) values
  ('opening', 'Check diffuser oil and turn sticks upside down', 1),
  ('opening', 'Check mobile device for reservations', 2),
  ('opening', 'Wipe the main door window for both rooms', 3),
  ('opening', 'Vacuum the bar and mop the bar area', 4),
  ('opening', 'Wipe bar island clean', 5),
  ('opening', 'Make sure snacks and tissues are stocked up', 6),
  ('opening', 'Setup bar island with premixes, garnishing and syrups', 7),
  ('opening', 'Check bar spirit levels and flag anything low before service', 8),
  ('opening', 'Check ice machine and fill ice bins', 9),
  ('opening', 'Check freshness of opened infusions and garnishes', 10),
  ('opening', 'Test all lights and music/sound system before guests arrive', 11);

-- Seed closing items
insert into public.checklist_items (type, text, sort_order) values
  ('closing', 'Take photo of each sales receipt', 1),
  ('closing', 'Do settlement for sales and send all receipts in WhatsApp group', 2),
  ('closing', 'Wipe and clean up premixes and syrups bottles', 3),
  ('closing', 'Clean all bar tools and put them back in place', 4),
  ('closing', 'Make sure no glasses are in sink — everything cleaned and put back', 5),
  ('closing', 'Clean the inside part of the bar island and finish with hot water', 6),
  ('closing', 'Soak dirty cloths in water overnight with soap', 7),
  ('closing', 'Make sure all airconds and lights are turned off', 8),
  ('closing', 'Dispose of cut garnishes — do not leave citrus/herbs overnight', 9),
  ('closing', 'Wipe down all spirit bottles and ensure caps are back on', 10),
  ('closing', 'Check all windows and doors are locked before leaving', 11),
  ('closing', 'Take out rubbish/bin liners', 12);
