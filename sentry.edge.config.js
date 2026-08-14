// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Sans DSN configuré, on n'initialise pas : Sentry émettrait sinon un
// avertissement à chaque démarrage pour une remontée qui n'ira nulle part.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    // Le DSN vient de l'environnement : il reste ainsi configurable par
    // déploiement (production, préproduction) sans modifier le code. Ce n'est
    // pas un secret — un DSN est un point d'ingestion public.
    dsn: process.env.SENTRY_DSN,

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    // Enable logs to be sent to Sentry
    enableLogs: true,

    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  });
}
