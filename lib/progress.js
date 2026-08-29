/**
 * lib/progress.js — La barre de chargement, pilotable depuis n'importe où.
 *
 * NProgress était jusqu'ici piloté depuis le seul composant de navigation, et
 * uniquement sur les clics de liens. Tout le reste passait sous le radar :
 * navigations programmées (router.push), envois de fichiers, Server Actions.
 * L'utilisateur voyait donc une barre pour certaines attentes et rien pour
 * d'autres, sans logique apparente.
 *
 * Ce module l'expose derrière trois fonctions, sûres à appeler côté serveur —
 * elles n'y font rien plutôt que de lever une erreur, ce qui évite d'avoir à
 * garder chaque appel.
 */

import NProgress from 'nprogress'

let configure = false

/**
 * NProgress touche au DOM. L'import est statique — le bundler le veut ainsi —
 * mais chaque appel vérifie qu'on est bien dans un navigateur, ce qui rend ces
 * fonctions sûres à appeler depuis n'importe où sans garde à l'appel.
 */
function nprogress() {
  if (typeof window === 'undefined') return null
  if (!configure) {
    NProgress.configure({ showSpinner: false, minimum: 0.08, trickleSpeed: 200 })
    configure = true
  }
  return NProgress
}

/** Démarre la barre. Sans effet si elle tourne déjà. */
export function startProgress() {
  nprogress()?.start()
}

/**
 * Fixe l'avancement réel, entre 0 et 1.
 *
 * Utilisé pour les envois de fichiers, où l'on connaît la proportion traitée :
 * une barre qui avance au rythme réel informe, là où une animation décorative
 * ne fait que meubler.
 */
export function setProgress(ratio) {
  const n = nprogress()
  if (!n) return
  // NProgress n'atteint jamais 1 de lui-même — c'est done() qui termine.
  n.set(Math.min(0.95, Math.max(0.08, ratio)))
}

/** Termine la barre. */
export function doneProgress() {
  nprogress()?.done()
}
