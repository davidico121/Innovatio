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

-- Members are added from the admin screen. They get an email with a temporary password.

-- v4: screenshot proof, personal todos and monthly goals.
alter table entries add column if not exists proof_image bytea;
alter table entries add column if not exists proof_image_type text;

-- Private to the member. Admins never read these tables.
create table if not exists todos (
  id serial primary key,
  member_id int not null references members(id) on delete cascade,
  title text not null,
  scope text not null check (scope in ('day', 'week')),
  period_start date not null,           -- the day itself, or the Monday of that week
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists todos_member_period on todos(member_id, scope, period_start);

create table if not exists goals (
  id serial primary key,
  member_id int not null references members(id) on delete cascade,
  title text not null,
  month date not null,                  -- first day of the month
  target int not null check (target > 0),
  progress int not null default 0 check (progress >= 0),
  created_at timestamptz not null default now()
);
create index if not exists goals_member_month on goals(member_id, month);

-- v5: screenshots are purged after 60 days; this marks entries whose proof was removed.
alter table entries add column if not exists proof_purged boolean not null default false;

-- v6: email and password sign-in. Safe to run again on an existing database.
alter table members add column if not exists password_hash text;
alter table members add column if not exists must_setup boolean not null default true;
alter table members add column if not exists temp_expires_at timestamptz;
alter table members add column if not exists invited_at timestamptz;
alter table members add column if not exists last_login_at timestamptz;
-- The old personal sign-in link is retired so it cannot be used as a back door.
alter table members drop column if exists token;

create table if not exists sessions (
  id serial primary key,
  member_id int not null references members(id) on delete cascade,
  token_hash text not null unique,      -- sha256 of the cookie value, never the value itself
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_member on sessions(member_id);

create table if not exists login_attempts (
  id serial primary key,
  key text not null,                    -- lowercased email that was tried
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_key on login_attempts(key, created_at);
create index if not exists login_attempts_ip on login_attempts(ip, created_at);
