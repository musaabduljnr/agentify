-- ============================================================
-- PAYMENT TRANSACTIONS SCHEMA
-- Step 11: Paystack & Flutterwave Checkout + Webhooks
-- ============================================================

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null check (provider in ('paystack', 'flutterwave')),
  reference text unique not null,
  provider_transaction_id text,
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null,
  amount integer not null,
  currency text default 'NGN',
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'abandoned', 'cancelled')),
  checkout_url text,
  raw_response jsonb default '{}'::jsonb,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table public.payment_transactions enable row level security;

-- Business owners can view their own transactions
drop policy if exists "Users can view own business payment transactions" on public.payment_transactions;
create policy "Users can view own business payment transactions"
on public.payment_transactions
for select
using (
  exists (
    select 1 from public.businesses
    where businesses.id = payment_transactions.business_id
    and businesses.owner_id = auth.uid()
  )
);

-- Performance index
create index if not exists idx_payment_transactions_business_id on public.payment_transactions(business_id);
create index if not exists idx_payment_transactions_reference on public.payment_transactions(reference);
create index if not exists idx_payment_transactions_status on public.payment_transactions(status);

-- Updated at auto-trigger
drop trigger if exists payment_transactions_updated_at on public.payment_transactions;
create trigger payment_transactions_updated_at
before update on public.payment_transactions
for each row
execute function public.handle_updated_at();
