-- TraceOn v2 — mini-site, avis clients, message de relance, capture d'appel
-- À exécuter dans l'éditeur SQL de Supabase.

-- ── Colonnes artisans ──
alter table artisans add column if not exists message_relance text;
alter table artisans add column if not exists slug text unique;
alter table artisans add column if not exists numero_traceon text;          -- num. de capture d'appel (Twilio)
alter table artisans add column if not exists google_avis_url text;          -- lien direct "laisser un avis Google"
alter table artisans add column if not exists avis_moyenne numeric(2,1) default 0;
alter table artisans add column if not exists avis_count int default 0;

-- ── Table avis ──
create table if not exists avis (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  artisan_id uuid references artisans(id) on delete cascade,
  demande_id uuid references demandes(id) on delete set null,
  client_nom text,
  note int not null check (note between 1 and 5),
  commentaire text,
  affiche boolean default true,        -- visible sur le mini-site
  source text default 'traceon'        -- 'traceon' | 'google'
);
create index if not exists idx_avis_artisan on avis(artisan_id);
create unique index if not exists idx_avis_demande on avis(demande_id) where demande_id is not null;

-- ── Capture d'appel : journal des appels reçus sur le numéro TraceOn ──
create table if not exists appels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  artisan_id uuid references artisans(id) on delete cascade,
  from_number text,
  statut text default 'manque',        -- 'manque' | 'repondu'
  sms_envoye boolean default false
);
create index if not exists idx_appels_artisan on appels(artisan_id);

-- ── RLS : avis lisibles publiquement (mini-site), écriture via service role ──
alter table avis enable row level security;
do $$ begin
  create policy "Avis affichés lisibles" on avis for select using (affiche = true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Avis gérés par service role" on avis for all using (true);
exception when duplicate_object then null; end $$;

alter table appels enable row level security;
do $$ begin
  create policy "Appels service role" on appels for all using (true);
exception when duplicate_object then null; end $$;

-- ── Génère un slug pour les artisans existants (à partir du nom d'entreprise) ──
update artisans set slug = lower(regexp_replace(coalesce(nullif(nom_entreprise,''), nom, 'pro'), '[^a-zA-Z0-9]+', '-', 'g'))
  || '-' || substr(md5(id::text), 1, 4)
  where slug is null;
