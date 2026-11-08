-- Viste-t · conjuntos (plan 2)
-- Ejecutar una vez en el editor SQL de Supabase, después de 0001_init.sql.

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mode text not null,
  request text,
  garment_ids uuid[] not null,
  locked_ids uuid[] not null default '{}',
  explanation text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'worn', 'rejected')),
  reject_reason text,
  worn_on date,
  weather jsonb,
  created_at timestamptz not null default now()
);
create index if not exists outfits_user_created_idx on public.outfits (user_id, created_at);

-- Cada "Cambiar solo esta": qué prenda no convenció dentro de qué conjunto.
create table if not exists public.outfit_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  garment_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.outfits enable row level security;
alter table public.outfit_swaps enable row level security;
