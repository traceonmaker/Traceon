-- TraceOn — Notifications push
-- À coller dans l'éditeur SQL de Supabase et exécuter UNE fois.
-- Stocke les souscriptions push (un objet par appareil) sur la fiche artisan.

alter table artisans add column if not exists push_subscriptions jsonb default '[]'::jsonb;
