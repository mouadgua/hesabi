# FiduCaire — Clés d'Accès Bêta

> Ces clés sont à usage unique. Une fois utilisée pour créer un compte, la clé est désactivée.
> Ne partagez pas ce fichier publiquement.

| #  | Clé                  | Statut      |
|----|----------------------|-------------|
| 1  | `FC-A3KM-P7RQ-X2HW` | Disponible  |
| 2  | `FC-B8NJ-V4TY-Z5CG` | Disponible  |
| 3  | `FC-C2QX-W9MK-A7PH` | Disponible  |
| 4  | `FC-D5RT-J3HB-N6YZ` | Disponible  |
| 5  | `FC-E7WK-Q2XP-M8TV` | Disponible  |
| 6  | `FC-F4HN-B8ZM-R3QJ` | Disponible  |
| 7  | `FC-G9PY-K5VT-W7XN` | Disponible  |
| 8  | `FC-H3ZQ-N7JR-B4MK` | Disponible  |
| 9  | `FC-J6MX-T2PW-Y8NB` | Disponible  |
| 10 | `FC-K8TH-Y4QN-C3RZ` | Disponible  |

## Utilisation

1. Envoyez une clé à votre utilisateur bêta
2. L'utilisateur la saisit sur la page d'inscription (`/register`)
3. La clé est consommée lors de la création du compte (impossible de l'utiliser une 2ème fois)
4. Marquez la ligne comme **Utilisée** dans ce fichier pour votre suivi

## Générer plus de clés

```bash
node prisma/seed-beta-keys.js
```

Pour voir le statut des clés en base :
```bash
npx prisma studio
```
