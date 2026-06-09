// Server-side instrumentation — runs once at startup.
// To activate Sentry: npm install @sentry/nextjs, set SENTRY_DSN, then
// uncomment the import below and remove the early return.
export async function register() {
  if (!process.env.SENTRY_DSN) return

  // After installing @sentry/nextjs, replace this block:
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   const { init } = await import('@sentry/nextjs')
  //   init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, tracesSampleRate: 0.1 })
  // }
}
