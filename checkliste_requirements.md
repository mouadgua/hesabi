# Checklist des alertes — Hesabi (avant lancement bêta)

> Objectif : être notifié AVANT qu'un cabinet ne le remarque et ne se plaigne.
> Chaque alerte doit avoir un canal de notification défini (email, Slack, SMS pour le critique) — pas juste un log qu'on ne regarde jamais.

---

## 1. Disponibilité & infrastructure

- [ ] App inaccessible (health check `/api/health` qui échoue) — **critique, notification immédiate**
- [ ] Base de données Neon injoignable ou latence anormale
- [ ] Erreur 5xx en hausse anormale sur une fenêtre de 5 minutes
- [ ] Cron `/api/cron/recovery` qui ne s'exécute pas à l'heure prévue (silence = problème)
- [ ] Espace de stockage Supabase proche de la limite du plan
- [ ] Quota Vercel (invocations, bande passante) proche de la limite du plan

## 2. Pipeline d'extraction IA

- [ ] Taux d'échec d'extraction anormalement élevé sur une fenêtre courte (ex: >15% en 10 min)
- [ ] Circuit breaker déclenché sur un provider (Gemini ou un maillon OpenRouter) — signal qu'un fournisseur a un incident
- [ ] Tous les providers du fallback chain épuisés pour un même document (échec total)
- [ ] File d'attente d'extraction anormalement longue (documents qui s'accumulent sans être traités)
- [ ] Documents bloqués en `EN_COURS_IA` récupérés en masse par le cron recovery (signal d'un problème sous-jacent, pas juste le filet de sécurité qui fonctionne)
- [ ] Azure OCR : quota gratuit de 500 pages/mois bientôt atteint (si mode hybride actif sur des cabinets)
- [ ] Azure OCR : erreurs 429 (rate limit) récurrentes

## 3. Sécurité

- [ ] Tentatives de connexion échouées répétées sur un même compte (brute-force potentiel)
- [ ] Tentative d'accès à des données hors du `cabinet_id` de l'utilisateur (violation IDOR détectée)
- [ ] Upload de fichier rejeté par la validation magic bytes de façon répétée depuis une même source
- [ ] Nouvelle CVE critique détectée dans une dépendance (Dependabot/Snyk)
- [ ] Connexion à la console admin depuis une IP ou un appareil inhabituel
- [ ] Pic anormal de requêtes depuis une seule IP (signal de scraping ou d'abus)
- [ ] Variable d'environnement/secret manquant au démarrage d'un déploiement

## 4. Facturation & crédits

- [ ] Cabinet dont les crédits tombent à zéro en pleine activité (impact direct sur son usage)
- [ ] Anomalie sur le système de crédits (décrément sans upload correspondant, ou l'inverse)
- [ ] Coût réel des appels IA (Gemini/OpenRouter/Azure) qui dépasse un seuil mensuel défini à l'avance
- [ ] Échec de webhook Stripe (une fois Stripe intégré) — paiement non reflété côté crédits

## 5. Qualité des données & expérience utilisateur

- [ ] Taux de correction manuelle anormalement élevé sur un type de document (signal que l'extraction se dégrade)
- [ ] Learning loop : préférence utilisateur créée à partir de corrections contradictoires (signal de donnée incohérente)
- [ ] Note de satisfaction basse reçue via `quality-survey.jsx`
- [ ] Nouveau "champ manquant" demandé fréquemment (`MissingFieldRequest`) — signal d'un besoin produit récurrent
- [ ] Export Excel/ZIP qui échoue en génération

## 6. Démo publique

- [ ] Pic d'utilisation anormal sur `/demo` (signal d'abus malgré le rate limiter)
- [ ] Taux d'échec d'extraction sur la démo — première impression cassée pour un prospect

## 7. Processus (à vérifier manuellement, pas automatisable)

- [ ] Revue mensuelle des logs admin (`AdminLog`) pour repérer une action suspecte passée inaperçue
- [ ] Revue trimestrielle des accès (qui a encore accès à quoi, en particulier après un départ)
- [ ] Test de restauration de sauvegarde effectué et documenté (pas juste supposé fonctionner)

---

## Priorisation pour le lancement bêta

**Avant publication (bloquant)** : sections 1, 2, 3 — sans ça, un incident critique passe inaperçu jusqu'à ce qu'un cabinet se plaigne.

**Dans le mois suivant le lancement** : sections 4, 5 — moins critique dans l'immédiat mais impacte directement la confiance des premiers utilisateurs.

**En continu, pas de deadline stricte** : section 6 et 7.