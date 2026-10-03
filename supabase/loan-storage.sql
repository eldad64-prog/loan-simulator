create table if not exists public.loan_portfolios (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_portfolio_backups (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.loan_portfolios enable row level security;
alter table public.loan_portfolio_backups enable row level security;

revoke all on table public.loan_portfolios from anon, authenticated, service_role;
revoke all on table public.loan_portfolio_backups from anon, authenticated, service_role;

grant select, insert, update, delete on table public.loan_portfolios to authenticated;
grant select, insert, update, delete on table public.loan_portfolio_backups to authenticated;

drop policy if exists "Users can read their own loan portfolio" on public.loan_portfolios;
drop policy if exists "Users can create their own loan portfolio" on public.loan_portfolios;
drop policy if exists "Users can update their own loan portfolio" on public.loan_portfolios;
drop policy if exists "Users can delete their own loan portfolio" on public.loan_portfolios;

create policy "Users can read their own loan portfolio"
on public.loan_portfolios
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own loan portfolio"
on public.loan_portfolios
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own loan portfolio"
on public.loan_portfolios
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own loan portfolio"
on public.loan_portfolios
for delete
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can read their own loan backup" on public.loan_portfolio_backups;
drop policy if exists "Users can create their own loan backup" on public.loan_portfolio_backups;
drop policy if exists "Users can update their own loan backup" on public.loan_portfolio_backups;
drop policy if exists "Users can delete their own loan backup" on public.loan_portfolio_backups;

create policy "Users can read their own loan backup"
on public.loan_portfolio_backups
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own loan backup"
on public.loan_portfolio_backups
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own loan backup"
on public.loan_portfolio_backups
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own loan backup"
on public.loan_portfolio_backups
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create index if not exists loan_portfolios_updated_at_idx
on public.loan_portfolios(updated_at);

create index if not exists loan_portfolio_backups_updated_at_idx
on public.loan_portfolio_backups(updated_at);
