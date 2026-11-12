-- Run once against an empty Postgres (Railway: Query tab, or psql).

create table if not exists work_types (
  key text primary key,
  label text not null
);

create table if not exists ipas (
  id serial primary key,
  name text not null,
  description text not null default '',
  document bytea,
  document_name text,
  document_type text,
  counts_weekends boolean not null default false,
  created_at timestamptz not null default now()
);

-- The daily targets an IPA sets for each work type.
create table if not exists ipa_tasks (
  ipa_id int not null references ipas(id) on delete cascade,
  work_key text not null references work_types(key),
  daily_min int not null check (daily_min >= 0),
  requires_proof boolean not null default true,
  primary key (ipa_id, work_key)
);

create table if not exists members (
  id serial primary key,
  name text not null,
  email text not null unique,
  token text not null unique default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  active boolean not null default true,
  ipa_id int references ipas(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists entries (
  id serial primary key,
  member_id int not null references members(id) on delete cascade,
  work_date date not null,
  work_key text not null references work_types(key),
  count int not null check (count > 0),
  proof_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists entries_member_date on entries(member_id, work_date);

create table if not exists push_subscriptions (
  id serial primary key,
  member_id int not null references members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists reminder_log (
  id serial primary key,
  member_id int not null,
  kind text not null,
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (member_id, kind, sent_on)
);

insert into work_types (key, label) values
  ('email_outreach',  'Email outreach'),
  ('scouting',        'Scouting'),
  ('brand_outreach',  'Brand outreach'),
  ('optimization',    'Account optimization'),
  ('report',          'End-of-day report')
on conflict (key) do nothing;

-- The current IPA. Other IPAs are added from the admin screen.
insert into ipas (name, description)
  select 'Email outreach IPA', 'Daily email outreach target.'
  where not exists (select 1 from ipas where name = 'Email outreach IPA');
insert into ipa_tasks (ipa_id, work_key, daily_min, requires_proof)
  select id, 'email_outreach', 500, true from ipas where name = 'Email outreach IPA'
  on conflict do nothing;

-- Assign a member: insert into members (name, email, ipa_id)
--   values ('Jane Doe', 'jane@example.com', (select id from ipas where name = 'Email outreach IPA'))
--   returning id, token;
-- Signed link to send them: https://YOUR_APP_URL/api/login?token=<token>
