'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, unstable_retry }) {
  useEffect(() => {
    console.error('[GlobalError]', error?.digest, error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 1rem' }}>
              <circle cx="12" cy="12" r="11" stroke="#1D9E75" strokeWidth="1.5" />
              <path d="M12 7v5M12 16v.5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
              Une erreur inattendue s'est produite
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem', maxWidth: '36ch' }}>
              L'application a rencontré un problème critique. Notre équipe a été notifiée.
            </p>
            {error?.digest && (
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
                Code: {error.digest}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => unstable_retry()}
              style={{
                background: '#1D9E75', color: '#fff', border: 'none',
                padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
            <a
              href="/"
              style={{
                background: '#f1f5f9', color: '#334155', textDecoration: 'none',
                padding: '0.625rem 1.25rem', borderRadius: '0.5rem',
                fontSize: '0.875rem', fontWeight: 600,
              }}
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
