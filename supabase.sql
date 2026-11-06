-- Meu Caixa: tabela de lançamentos protegida por usuário (RLS).
-- Cole tudo no Supabase > SQL Editor e clique em Run.

create table if not exists public.transacoes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('in','out')),   -- in = entrada, out = saída
  valor      numeric(12,2) not null check (valor > 0),
  descricao  text not null default '',
  categoria  text not null,
  data       date not null,
  criado_em  timestamptz not null default now()
);

create index if not exists transacoes_user_data_idx on public.transacoes (user_id, data desc);

-- Row Level Security: cada pessoa só enxerga e altera as PRÓPRIAS linhas.
alter table public.transacoes enable row level security;

drop policy if exists "ver os proprios"      on public.transacoes;
drop policy if exists "inserir os proprios"  on public.transacoes;
drop policy if exists "editar os proprios"   on public.transacoes;
drop policy if exists "apagar os proprios"   on public.transacoes;

create policy "ver os proprios"     on public.transacoes for select to authenticated using ((select auth.uid()) = user_id);
create policy "inserir os proprios" on public.transacoes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "editar os proprios"  on public.transacoes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apagar os proprios"  on public.transacoes for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.transacoes to authenticated;
