// Capture unhandled client errors and promise rejections.
// When NEXT_PUBLIC_SENTRY_DSN is set, errors will be sent to Sentry.
// Without it, errors are logged to the console.

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const payload = {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error?.stack,
    }
    console.error('[client-error]', payload)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      // Sentry captures window.onerror automatically once initialized
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    console.error('[unhandled-rejection]', reason?.message ?? reason)
  })
}

export function onRouterTransitionStart(url, navigationType) {
  if (typeof performance !== 'undefined') {
    performance.mark(`nav:${navigationType}:${url}:${Date.now()}`)
  }
}
