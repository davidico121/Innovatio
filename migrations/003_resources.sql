-- A library of links the admin shares with the team: videos, guides and other pages.
-- Additive and safe to run again. Nothing is uploaded: every resource is just a link.
create table if not exists resources (
  id serial primary key,
  title text not null,
  url text not null,
  kind text not null default 'link' check (kind in ('video', 'guide', 'link')),
  category text not null default '',
  description text not null default '',
  pinned boolean not null default false,
  published boolean not null default true,
  position int not null default 0,         -- lower comes first
  notified_at timestamptz,                 -- when the team was last told about it, so it is not announced twice
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which IPAs a resource is meant for. A resource with no rows here is for everyone.
create table if not exists resource_ipas (
  resource_id int not null references resources(id) on delete cascade,
  ipa_id int not null references ipas(id) on delete cascade,
  primary key (resource_id, ipa_id)
);
create index if not exists resource_ipas_ipa on resource_ipas(ipa_id);

-- How often each resource is opened, per day. Counts only: it never records who opened it.
create table if not exists resource_opens (
  resource_id int not null references resources(id) on delete cascade,
  day date not null,
  opens int not null default 0,
  primary key (resource_id, day)
);
