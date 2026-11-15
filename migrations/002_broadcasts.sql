-- A log of the messages the admin broadcasts to the team. Additive and safe to run again.
create table if not exists broadcasts (
  id serial primary key,
  title text not null,
  body text not null,
  also_email boolean not null default false,
  members int not null default 0,        -- active members it was addressed to
  push_members int not null default 0,   -- members with at least one device the notification reached
  push_devices int not null default 0,   -- devices the notification reached
  emailed int not null default 0,        -- emails sent
  email_failed int not null default 0,   -- emails that could not be sent
  created_at timestamptz not null default now()
);
