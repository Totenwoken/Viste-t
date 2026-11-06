-- Viste-t · esquema inicial (plan 1: base + armario)
-- Ejecutar una vez en el editor SQL de Supabase.

create table if not exists public.garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'error')),
  image_path text,
  type text,
  description text,
  colors text[] not null default '{}',
  formality smallint check (formality between 1 and 5),
  seasons text[] not null default '{}',
  pattern text,
  material text,
  availability text not null default 'disponible' check (availability in ('disponible', 'lavanderia', 'guardada')),
  suit_pair_id uuid references public.garments(id) on delete set null,
  jacket_combinable boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists garments_user_status_idx on public.garments (user_id, status);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_ledger_user_created_idx on public.usage_ledger (user_id, created_at);

-- Solo accede la service key desde las funciones de Vercel: RLS activado y sin políticas.
alter table public.garments enable row level security;
alter table public.usage_ledger enable row level security;

-- Bucket privado para las fotos de las prendas.
insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;
