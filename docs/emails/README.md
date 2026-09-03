# Emails d'authentification — où changer quoi

Ces emails ne sont **pas envoyés par l'application** : c'est Supabase qui les
compose et les expédie. Rien de tout cela ne se règle dans le code — d'où ce
document.

---

## 1. Le lien menait vers localhost — corrigé à moitié

Le lien reçu par mail pointait sur `localhost:3000`. Deux causes, dont une seule
était dans le code :

**Dans le code (corrigé).** `app/forgot-password/actions.js` construisait le
lien à partir de l'en-tête `Origin`, qui n'est pas envoyé sur toutes les
requêtes. Quand il manquait, `redirectTo` valait `null/auth/callback…` :
Supabase le rejetait sans le dire et retombait sur son propre réglage.

**Dans Supabase (à faire par toi).** Ce réglage de repli est encore sur
localhost. Tant qu'il n'est pas changé, le problème peut réapparaître.

### Authentication › URL Configuration

| Champ | Valeur à mettre |
|---|---|
| **Site URL** | `https://hesabi.ma` |
| **Redirect URLs** | `https://hesabi.ma/**` |

⚠️ **`https`, pas `http`.** Un Site URL en `http://` produit un lien que le
navigateur refuse ou dégrade sur un site servi en HTTPS, et l'en-tête HSTS du
site le bloque de toute façon. Le `s` manquant suffit à casser toute la
récupération de mot de passe.

⚠️ La liste des *Redirect URLs* ne contient aujourd'hui que
`http://localhost:3000/auth/callback`. Tant que `https://hesabi.ma/**` n'y
figure pas, Supabase **rejette** le lien envoyé par l'application et retombe
sur le Site URL — c'est exactement le mécanisme qui a produit le lien vers
localhost.

Ajoute aussi `http://localhost:3000/**` dans les *Redirect URLs* si tu veux que
la réinitialisation continue de fonctionner en développement. Le *Site URL*,
lui, doit rester le domaine de production : c'est le repli utilisé quand tout
le reste échoue.

---

## 2. L'email est en anglais et signé Supabase

Il arrive de `noreply@mail.app.supabase.io`, avec « powered by Supabase » en
pied. Deux réglages distincts.

### Le contenu — Authentication › Emails › Reset Password

Colle le contenu de `reinitialisation-mot-de-passe.html` dans **Message body**,
et remplace le sujet par :

```
Réinitialiser votre mot de passe Hesabi
```

`{{ .ConfirmationURL }}` est la variable que Supabase remplace par le lien réel.
Elle doit rester telle quelle.

Les autres gabarits à traduire de la même façon, dans le même écran :
*Confirm signup*, *Magic Link*, *Invite user*, *Change email address*.

### L'expéditeur — Project Settings › Authentication › SMTP Settings

Tant que le SMTP par défaut est utilisé, l'email part de `supabase.io` et la
mention « powered by Supabase » reste. Ce serveur est par ailleurs **fortement
bridé** : quelques emails par heure, ce qui ne tient pas sur une bêta.

Ta clé Resend est déjà déployée. Renseigne :

| Champ | Valeur |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | ta clé `RESEND_API_KEY` |
| Sender email | `noreply@hesabi.ma` |
| Sender name | `Hesabi` |

⚠️ `noreply@hesabi.ma` suppose que le domaine `hesabi.ma` est **vérifié chez
Resend** (enregistrements SPF et DKIM). Sans cette vérification, les emails
partiront en indésirables — ou ne partiront pas. C'est à faire avant, dans le
tableau de bord Resend.

---

## 3. Le logo

Le gabarit utilise `public/hesabi-email-logo.png`, dérivé de ton `logo-text.png`.

Le fichier d'origine fait 2000×2000 pour 292 Ko, presque entièrement composé de
marge blanche. Dans un email c'est doublement gênant : **Gmail tronque les
messages au-delà d'environ 100 Ko**, et l'image est retéléchargée à chaque
ouverture. La version pour email est recadrée sur la bande utile et réduite à
**440×136 px pour 23 Ko** — affichée à 140 px, donc nette sur écran à haute
densité.

Deux détails qui comptent dans le gabarit :

- `width` et `height` sont explicites. Sans eux, Outlook affiche l'image à sa
  taille réelle et fait exploser la mise en page ;
- l'attribut `alt` porte « Hesabi ». Beaucoup de clients bloquent les images par
  défaut : c'est alors le seul élément d'identification visible.

Si tu modifies le logo, régénère la version email plutôt que de pointer sur
l'original :

```bash
sips -c 620 2000 public/logo-text.png --out /tmp/crop.png
sips -Z 440 /tmp/crop.png --out public/hesabi-email-logo.png
```

---

## Vérifier que ça marche

Après les changements : demande une réinitialisation avec une vraie adresse,
et contrôle que le lien reçu commence par `https://hesabi.ma` et non
`localhost`. C'est le seul test qui compte — le reste ne se voit pas.
