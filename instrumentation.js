// Server-side instrumentation — runs once, at startup, before any request.
import { validateEnv } from './lib/env.js'

export async function register() {
  // Report the environment first: if a key is missing, everything below and
  // every later failure is easier to read with that stated up front.
  validateEnv()

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config.js')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config.js')
  }
}

// Captures errors thrown inside App Router route handlers and server
// components. Without this export they never reach Sentry.
export async function onRequestError(...args) {
  const Sentry = await import('@sentry/nextjs')
  return Sentry.captureRequestError(...args)
}
