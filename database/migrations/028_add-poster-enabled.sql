-- Ajouter la colonne poster_enabled à la table events
-- Par défaut TRUE : tous les événements existants gardent la fonctionnalité activée
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS poster_enabled BOOLEAN NOT NULL DEFAULT TRUE;
