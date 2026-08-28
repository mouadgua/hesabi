-- Trace de l'acceptation de l'avertissement bêta.
--
-- Le formulaire d'inscription exige une case cochée (stockage des documents,
-- données sensibles, absence de garantie), et le serveur la revérifie. Sans
-- cette colonne, l'acceptation était vérifiée puis oubliée : impossible
-- d'établir plus tard qu'elle a bien eu lieu, ni quand.
--
-- Nullable à dessein : les comptes créés avant cette date n'ont jamais vu
-- l'avertissement, et une valeur par défaut leur prêterait une acceptation
-- qu'ils n'ont pas donnée.
ALTER TABLE "Utilisateur"
  ADD COLUMN IF NOT EXISTS "beta_ack_at" TIMESTAMP(3);
