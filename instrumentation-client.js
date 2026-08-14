// Instrumentation navigateur — chargée une fois au démarrage côté client.
//
// Sans ce fichier, seules les erreurs serveur remontaient : tout ce qui casse
// dans le navigateur (rendu React, promesse rejetée, appel réseau qui échoue)
// restait invisible, alors que c'est précisément ce que voit l'utilisateur.
//
// Le DSN doit être préfixé NEXT_PUBLIC_ pour être injecté dans le bundle au
// moment du build — il est donc figé au déploiement, pas lu à l'exécution.

import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    tracesSampleRate: 1,
    enableLogs: true,

    // L'envoi passe par le tunnel /monitoring déclaré dans next.config.mjs :
    // même origine, donc conforme à la CSP stricte des pages authentifiées et
    // insensible aux bloqueurs de publicité.
  })
} else if (typeof window !== 'undefined') {
  // Pas de DSN : on garde au moins une trace en console plutôt que rien.
  window.addEventListener('error', event => {
    console.error('[client-error]', {
      message: event.message,
      source:  event.filename,
      line:    event.lineno,
      stack:   event.error?.stack,
    })
  })
  window.addEventListener('unhandledrejection', event => {
    console.error('[unhandled-rejection]', event.reason?.message ?? event.reason)
  })
}

// Mesure les transitions de navigation côté client — Next.js appelle ce hook
// à chaque changement de route.
export function onRouterTransitionStart(url, navigationType) {
  Sentry.captureRouterTransitionStart?.(url, navigationType)
  if (typeof performance !== 'undefined') {
    performance.mark(`nav:${navigationType}:${url}:${Date.now()}`)
  }
}
