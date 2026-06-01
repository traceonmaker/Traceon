-- TraceOn — Durcissement sécurité (RLS)
-- À coller dans l'éditeur SQL de Supabase et exécuter UNE fois.
-- Objectif : couper l'accès direct aux données client (PII) via la clé publique (anon).
-- Les routes API utilisent le service role, qui bypasse la RLS → l'application continue de fonctionner.

-- 1) DEMANDES (contiennent nom/téléphone/adresse des clients) : aucun accès direct anon/authenticated.
alter table demandes enable row level security;
drop policy if exists "Demandes lisibles par token" on demandes;
drop policy if exists "Demandes modifiables par service role" on demandes;
-- (plus aucune policy permissive → seul le service role, via les API, peut lire/écrire les demandes)

-- 2) ARTISANS : on garde la lecture publique des colonnes "vitrine" (nécessaires au formulaire client),
--    mais on retire l'accès aux colonnes sensibles (email, identifiants Stripe, abonnement…) pour la clé publique.
--    NB : à activer seulement après avoir déplacé la résolution email→artisan côté serveur (/api/artisan/me),
--    sinon la connexion (lookup par email via anon) casse. Laissé en commentaire pour l'instant.
-- revoke select on artisans from anon;
-- grant select (id, nom, nom_entreprise, logo_url, types_chantier, zone_intervention) on artisans to anon;
