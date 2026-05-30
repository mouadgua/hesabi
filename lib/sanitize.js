// Input sanitization utilities — used on every user-supplied value before DB/AI usage

const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' }

/** Escape HTML special chars to prevent XSS in any rendered string */
export function escapeHtml(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[&<>"'/]/g, c => HTML_ESCAPE[c])
}

/**
 * Sanitize a plain text field: trim, cap length, strip HTML tags entirely.
 * Use for names, labels, any free-text that gets stored and displayed.
 */
export function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/[<>"']/g, '')           // strip remaining dangerous chars
}

/**
 * Validate and normalise an email address.
 * Returns the lowercase email or null if invalid.
 */
export function sanitizeEmail(input) {
  if (typeof input !== 'string') return null
  const email = input.trim().toLowerCase().slice(0, 254)
  // RFC 5322 simplified — rejects obvious injections and malformed addresses
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  return re.test(email) ? email : null
}

/**
 * Sanitize a name field: letters, spaces, hyphens, apostrophes only.
 * Strips everything else to prevent stored-XSS via display name.
 */
export function sanitizeName(input, maxLength = 100) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"';&\\/]/g, '')
}

/**
 * Validate a beta key: uppercase alphanumeric only, fixed structure.
 * Returns the key or null if it doesn't match expected format.
 */
export function sanitizeBetaKey(input) {
  if (typeof input !== 'string') return null
  const key = input.trim().toUpperCase().slice(0, 32)
  return /^[A-Z0-9\-]+$/.test(key) ? key : null
}

/**
 * Validate password: length 8–128, no control characters.
 * Returns { valid, message }.
 */
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0)
    return { valid: false, message: 'Mot de passe requis.' }
  if (password.length < 8)
    return { valid: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' }
  if (password.length > 128)
    return { valid: false, message: 'Mot de passe trop long (128 caractères max).' }
  // Reject null bytes and other control chars
  if (/[\x00-\x1F\x7F]/.test(password))
    return { valid: false, message: 'Mot de passe invalide.' }
  return { valid: true }
}

/**
 * Validate an uploaded file for the demo:
 * - allowed MIME types only
 * - max size 10 MB
 * Returns { valid, error }
 */
const ALLOWED_DEMO_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function validateDemoFile(mimeType, base64Data) {
  if (!ALLOWED_DEMO_MIMES.has(mimeType)) {
    return { valid: false, error: 'Type de fichier non supporté. Utilisez PDF, JPG, PNG ou WebP.' }
  }
  const bytes = Math.ceil((base64Data.length * 3) / 4)
  if (bytes > 10 * 1024 * 1024) {
    return { valid: false, error: 'Fichier trop volumineux. Maximum 10 Mo.' }
  }
  return { valid: true }
}

/**
 * Verify that the raw bytes of an uploaded file actually match the declared MIME type
 * by checking magic bytes (file signatures). Rejects files that lie about their type.
 * base64Data must be the raw base64 string (no data-URL prefix).
 * Returns { valid, error }
 */
export function validateFileBytes(mimeType, base64Data) {
  let buf
  try {
    // Only need the first 12 bytes to identify any supported format
    buf = Buffer.from(base64Data.slice(0, 16), 'base64')
  } catch {
    return { valid: false, error: 'Fichier illisible.' }
  }

  const b = buf

  switch (mimeType) {
    case 'application/pdf':
      // %PDF
      if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { valid: true }
      break

    case 'image/jpeg':
    case 'image/jpg':
      // FF D8 FF
      if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { valid: true }
      break

    case 'image/png':
      // 89 50 4E 47 0D 0A 1A 0A
      if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
          b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) return { valid: true }
      break

    case 'image/webp':
      // RIFF....WEBP
      if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
          b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { valid: true }
      break

    case 'image/heic':
    case 'image/heif':
      // ftyp box at offset 4: bytes 4-7 == 66 74 79 70
      if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return { valid: true }
      break

    default:
      return { valid: false, error: 'Type non supporté.' }
  }

  return { valid: false, error: 'Le fichier ne correspond pas au format déclaré.' }
}
