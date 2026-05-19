
-- Profiles (customers + admins)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  whatsapp_number text unique not null,
  wallet_balance numeric not null default 0,
  role text not null default 'customer' check (role in ('customer','admin')),
  language_preference text not null default 'en' check (language_preference in ('en','pidgin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Service items catalog
create table public.service_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  price numeric not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.service_items enable row level security;

-- Promo codes
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percentage','fixed')),
  value numeric not null,
  min_order_amount numeric not null default 0,
  expiry_date date,
  usage_limit integer,
  times_used integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  service_type text not null check (service_type in ('laundry','cleaning')),
  items_json jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  delivery_fee numeric not null default 0,
  discount_amount numeric not null default 0,
  total_amount numeric not null default 0,
  promo_code_id uuid references public.promo_codes(id),
  delivery_method text not null default 'dropoff' check (delivery_method in ('dropoff','pickup')),
  address text,
  special_instructions text,
  status text not null default 'received' check (status in ('pending','received','washing','ready','delivered','cancelled')),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create index orders_profile_idx on public.orders(profile_id, created_at desc);

-- Wallet transactions
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('credit','debit')),
  amount numeric not null,
  description text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.wallet_transactions enable row level security;
create index wallet_tx_profile_idx on public.wallet_transactions(profile_id, created_at desc);

-- Notifications (in-app + queued WhatsApp)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  channel text not null default 'in_app' check (channel in ('in_app','whatsapp_pending','whatsapp_sent')),
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_profile_idx on public.notifications(profile_id, created_at desc);

-- Deny-all RLS: every table is accessed only via the service-role server functions.
-- (No policies = no access for anon/authenticated roles, which is what we want.)

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Realtime
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.wallet_transactions;
alter publication supabase_realtime add table public.notifications;

-- Seed: laundry items
insert into public.service_items (category, name, price) values
  ('laundry_soft','T-Shirt / Casual Top',150),
  ('laundry_soft','Polo Shirt',200),
  ('laundry_soft','Casual Shirt',200),
  ('laundry_soft','Underwear / Socks (set)',150),
  ('laundry_soft','Singlet',100),
  ('laundry_soft','Shorts',150),
  ('laundry_soft','Light Dress',300),
  ('laundry_soft','Skirt',200),
  ('laundry_hard','Jeans',300),
  ('laundry_hard','Trousers',300),
  ('laundry_hard','Suit Jacket',600),
  ('laundry_hard','Blazer',500),
  ('laundry_hard','Coat / Heavy Jacket',800),
  ('laundry_hard','Native Attire (Agbada / Babariga)',1200),
  ('laundry_hard','School Uniform (set)',400),
  ('laundry_bedding','Pillowcase',150),
  ('laundry_bedding','Bed Sheet (Single)',500),
  ('laundry_bedding','Bed Sheet (Double)',700),
  ('laundry_bedding','Bed Sheet (King)',900),
  ('laundry_bedding','Pillow',600),
  ('laundry_bedding','Duvet (Single)',1500),
  ('laundry_bedding','Duvet (Double)',2000),
  ('laundry_bedding','Curtain (per panel)',800),
  ('laundry_bedding','Towel',400),
  ('laundry_bedding','Table Cloth',500);

-- Seed: cleaning items
insert into public.service_items (category, name, price) values
  ('cleaning_apartment','Self-contained',5000),
  ('cleaning_apartment','1-Bedroom Flat',8000),
  ('cleaning_apartment','2-Bedroom Flat',12000),
  ('cleaning_apartment','3-Bedroom Flat',16000),
  ('cleaning_apartment','4-Bedroom Flat',20000),
  ('cleaning_apartment','Full House / Duplex',30000),
  ('cleaning_office','Small Office (per room)',3500),
  ('cleaning_office','Medium Office (per room)',5000),
  ('cleaning_office','Large Office (per room)',7500),
  ('cleaning_other','Shop / Store',8000),
  ('cleaning_other','School / Institution',15000),
  ('cleaning_other','Other (custom quote)',10000);

-- Seed: delivery fee item
insert into public.service_items (category, name, price) values
  ('delivery','Pickup & Delivery',1000);

-- Seed: promo code
insert into public.promo_codes (code, type, value, min_order_amount, is_active)
values ('FRESH10','percentage',10,1000,true);
