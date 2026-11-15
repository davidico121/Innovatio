-- Notifications follow the account that is signed in. Additive and safe to run again, so it is also
-- safe to run before the matching code is deployed (older code never touches these).

-- A member's device is linked to the sign-in it was turned on from, so signing out removes it.
alter table push_subscriptions add column if not exists session_id int references sessions(id) on delete cascade;
create index if not exists push_subscriptions_session on push_subscriptions(session_id);

-- Devices that get the admin's notifications. The admin has no session row, so each device
-- remembers which admin sign-in (session_key) turned it on, and signing out of admin removes it.
create table if not exists admin_push_subscriptions (
  id serial primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  session_key text,
  linked_at timestamptz not null default now()
);
