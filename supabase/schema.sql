-- Ruckus persistence schema. Run in the Supabase SQL editor (or `supabase db push`).
-- The Python server talks to these tables with the service-role key, so RLS
-- only needs to allow public reads of the leaderboard.

create table if not exists public.players (
  id          text primary key,
  name        text not null default 'Player',
  avatar      jsonb not null default '{}'::jsonb,
  wins        integer not null default 0,
  games       integer not null default 0,
  points      integer not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id          bigserial primary key,
  room_code   text not null,
  game        text not null,
  players     jsonb not null,
  results     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists matches_room_idx on public.matches (room_code, created_at desc);
create index if not exists players_rank_idx on public.players (points desc, wins desc);

-- Atomically upsert a player and add one match result to their totals.
create or replace function public.record_result(
  p_id text, p_name text, p_avatar jsonb, p_win integer, p_points integer
) returns void language sql security definer as $$
  insert into public.players (id, name, avatar, wins, games, points, updated_at)
  values (p_id, p_name, p_avatar, p_win, 1, p_points, now())
  on conflict (id) do update set
    name = excluded.name,
    avatar = excluded.avatar,
    wins = public.players.wins + excluded.wins,
    games = public.players.games + 1,
    points = public.players.points + excluded.points,
    updated_at = now();
$$;

alter table public.players enable row level security;
alter table public.matches enable row level security;

drop policy if exists "leaderboard is public" on public.players;
create policy "leaderboard is public" on public.players for select using (true);
