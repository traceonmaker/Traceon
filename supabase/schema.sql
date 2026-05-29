-- TraceOn — Schéma Supabase
-- Coller dans l'éditeur SQL de Supabase et exécuter

-- Extension pour les tokens
create extension if not exists "pgcrypto";

-- Artisans
create table if not exists artisans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nom text not null,
  nom_entreprise text,
  email text unique not null,
  telephone text,
  logo_url text,
  types_chantier jsonb default '[
    {"type":"Plomberie","couleur":"#3B82F6","duree":2,"prix_base":150},
    {"type":"Électricité","couleur":"#F59E0B","duree":3,"prix_base":200},
    {"type":"Climatisation","couleur":"#06B6D4","duree":4,"prix_base":300},
    {"type":"Maçonnerie","couleur":"#EF4444","duree":6,"prix_base":400},
    {"type":"Peinture","couleur":"#8B5CF6","duree":4,"prix_base":250},
    {"type":"Autre","couleur":"#6B7280","duree":3,"prix_base":180}
  ]'::jsonb,
  horaires jsonb default '{
    "lundi":{"debut":"08:00","fin":"18:00","actif":true},
    "mardi":{"debut":"08:00","fin":"18:00","actif":true},
    "mercredi":{"debut":"08:00","fin":"18:00","actif":true},
    "jeudi":{"debut":"08:00","fin":"18:00","actif":true},
    "vendredi":{"debut":"08:00","fin":"18:00","actif":true},
    "samedi":{"debut":"08:00","fin":"13:00","actif":false},
    "dimanche":{"debut":"00:00","fin":"00:00","actif":false}
  }'::jsonb,
  abonnement_actif boolean default false,
  lien_formulaire text unique
);

-- Demandes
create table if not exists demandes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  artisan_id uuid references artisans(id) on delete cascade,
  token text unique default encode(gen_random_bytes(16), 'hex'),
  statut text default 'nouvelle' check (statut in (
    'nouvelle','devis_envoye','creneau_propose','confirme','en_cours','paye','annule'
  )),
  -- Client
  client_nom text not null,
  client_telephone text not null,
  client_adresse text not null,
  client_description text,
  -- Intervention
  type_intervention text not null,
  envergure text check (envergure in ('petit','moyen','grand')),
  prix_estime numeric(10,2),
  -- Planning
  creneaux_proposes jsonb,
  creneau_accepte jsonb,
  -- Timestamps
  date_confirmation timestamptz,
  date_chantier timestamptz,
  date_paiement timestamptz
);

-- Index
create index if not exists idx_demandes_artisan on demandes(artisan_id);
create index if not exists idx_demandes_token on demandes(token);
create index if not exists idx_demandes_statut on demandes(artisan_id, statut);

-- RLS
alter table artisans enable row level security;
alter table demandes enable row level security;

-- Policies artisans (service role bypasse RLS)
create policy "Artisans publics en lecture" on artisans for select using (true);
create policy "Artisans modifiables par service role" on artisans for all using (true);

-- Policies demandes
create policy "Demandes lisibles par token" on demandes for select using (true);
create policy "Demandes modifiables par service role" on demandes for all using (true);
