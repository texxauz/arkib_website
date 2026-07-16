create table if not exists pos_receipt_emails (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references pos_orders(id) on delete cascade,
  sent_to     text not null,
  sent_by     uuid references auth.users(id),
  sent_by_name text,
  sent_at     timestamptz not null default now(),
  receipt_html text not null
);

create index if not exists pos_receipt_emails_order_id_idx on pos_receipt_emails(order_id);
create index if not exists pos_receipt_emails_sent_at_idx  on pos_receipt_emails(sent_at desc);

-- Staff can insert; only admins can read all rows via service role
alter table pos_receipt_emails enable row level security;

create policy "authenticated users can insert receipt emails"
  on pos_receipt_emails for insert to authenticated with check (true);

create policy "authenticated users can read receipt emails"
  on pos_receipt_emails for select to authenticated using (true);
