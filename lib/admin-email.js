/**
 * lib/admin-email.js — L'adresse qui donne l'accès administrateur.
 *
 * Isolée dans un module sans aucune dépendance, et c'est la raison d'être de ce
 * fichier : lib/admin-auth.js importe Prisma, ce qui l'interdit au middleware
 * (qui tourne sur le runtime edge) comme aux composants client. La constante
 * s'était donc retrouvée recopiée dans quatre fichiers.
 *
 * Quatre copies d'une même adresse finissent par diverger — et c'est la copie
 * oubliée qui laisse un accès ouvert après un changement d'adresse.
 */
export const ADMIN_EMAIL = 'mouadguarraz@gmail.com'
