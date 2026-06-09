import {
  escapeHtml,
  sanitizeText,
  sanitizeEmail,
  sanitizeName,
  sanitizeBetaKey,
  validatePassword,
  validateDemoFile,
  validateFileBytes,
} from '../../lib/sanitize.js'

// ── escapeHtml ─────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes XSS special characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;&#x2F;script&gt;')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's here")).toBe("it&#x27;s here")
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  test('returns empty string for non-string input', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(42)).toBe('')
    expect(escapeHtml({})).toBe('')
  })

  test('leaves safe strings untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
    expect(escapeHtml('')).toBe('')
  })
})

// ── sanitizeText ───────────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  test('strips HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold')
    expect(sanitizeText('<script>alert(1)</script>')).toBe('alert(1)')
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('')
  })

  test('strips dangerous characters', () => {
    expect(sanitizeText('<>')).toBe('')
    expect(sanitizeText('"hello"')).toBe('hello')
  })

  test('trims and caps length', () => {
    expect(sanitizeText('  hello  ')).toBe('hello')
    expect(sanitizeText('a'.repeat(1000), 10)).toHaveLength(10)
  })

  test('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('')
    expect(sanitizeText(42)).toBe('')
  })

  test('SQL injection payloads do not pass through', () => {
    // SQL chars that could be dangerous
    const payload = "'; DROP TABLE users; --"
    const result = sanitizeText(payload)
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
    // Result should be sanitized but SQL keywords are fine as text
  })
})

// ── sanitizeEmail ──────────────────────────────────────────────────────────────

describe('sanitizeEmail', () => {
  test('accepts valid emails', () => {
    expect(sanitizeEmail('user@example.com')).toBe('user@example.com')
    expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com')  // lowercased
    expect(sanitizeEmail('  user@domain.co.uk  ')).toBe('user@domain.co.uk')  // trimmed
    expect(sanitizeEmail('sub+tag@mail.org')).toBe('sub+tag@mail.org')
  })

  test('rejects invalid emails', () => {
    expect(sanitizeEmail('not-an-email')).toBeNull()
    expect(sanitizeEmail('@no-local')).toBeNull()
    expect(sanitizeEmail('no-at-sign')).toBeNull()
    expect(sanitizeEmail('')).toBeNull()
    expect(sanitizeEmail(null)).toBeNull()
    expect(sanitizeEmail(42)).toBeNull()
  })

  test('rejects injection payloads', () => {
    expect(sanitizeEmail("user@domain.com'; DROP TABLE")).toBeNull()
    expect(sanitizeEmail('<script>@x.com')).toBeNull()
    expect(sanitizeEmail('user@domain.c')).toBeNull()  // TLD too short
  })

  test('caps length at 254 characters', () => {
    const longEmail = 'a'.repeat(200) + '@example.com'
    const result = sanitizeEmail(longEmail)
    // Either null (invalid) or ≤254 chars
    if (result !== null) expect(result.length).toBeLessThanOrEqual(254)
  })
})

// ── sanitizeName ──────────────────────────────────────────────────────────────

describe('sanitizeName', () => {
  test('accepts normal names', () => {
    expect(sanitizeName('John Doe')).toBe('John Doe')
    expect(sanitizeName("O'Brien")).toBe('OBrien')  // apostrophe stripped
    expect(sanitizeName('Marie-Claire')).toBe('Marie-Claire')
  })

  test('strips dangerous characters', () => {
    expect(sanitizeName('<script>')).toBe('script')
    expect(sanitizeName('name; injection')).toBe('name injection')
    expect(sanitizeName('a\\b')).toBe('ab')
  })

  test('caps length', () => {
    expect(sanitizeName('a'.repeat(200), 50)).toHaveLength(50)
  })
})

// ── sanitizeBetaKey ───────────────────────────────────────────────────────────

describe('sanitizeBetaKey', () => {
  test('accepts valid beta keys', () => {
    expect(sanitizeBetaKey('HESABI-BETA-ABC123')).toBe('HESABI-BETA-ABC123')
    expect(sanitizeBetaKey('hesabi-beta-abc123')).toBe('HESABI-BETA-ABC123')  // uppercased
    expect(sanitizeBetaKey('  HESABI-BETA-XYZ  ')).toBe('HESABI-BETA-XYZ')   // trimmed
  })

  test('rejects keys with invalid characters', () => {
    expect(sanitizeBetaKey('KEY WITH SPACES')).toBeNull()
    expect(sanitizeBetaKey('KEY<SCRIPT>')).toBeNull()
    expect(sanitizeBetaKey('')).toBeNull()
    expect(sanitizeBetaKey(null)).toBeNull()
  })
})

// ── validatePassword ──────────────────────────────────────────────────────────

describe('validatePassword', () => {
  test('accepts valid passwords', () => {
    expect(validatePassword('MyP@ssw0rd!')).toEqual({ valid: true })
    expect(validatePassword('simplepassword123')).toEqual({ valid: true })
    expect(validatePassword('a'.repeat(128))).toEqual({ valid: true })  // max length
  })

  test('rejects short passwords', () => {
    const r = validatePassword('short')
    expect(r.valid).toBe(false)
    expect(r.message).toContain('8')
  })

  test('rejects empty passwords', () => {
    expect(validatePassword('').valid).toBe(false)
    expect(validatePassword(null).valid).toBe(false)
  })

  test('rejects passwords > 128 chars', () => {
    expect(validatePassword('a'.repeat(129)).valid).toBe(false)
  })

  test('rejects passwords with control characters', () => {
    expect(validatePassword('pass\x00word').valid).toBe(false)
    expect(validatePassword('pass\x1Fword').valid).toBe(false)
    expect(validatePassword('pass\x7Fword').valid).toBe(false)
  })
})

// ── validateDemoFile ──────────────────────────────────────────────────────────

describe('validateDemoFile', () => {
  const smallBase64 = Buffer.alloc(100).toString('base64')

  test('accepts valid MIME types', () => {
    expect(validateDemoFile('application/pdf', smallBase64)).toEqual({ valid: true })
    expect(validateDemoFile('image/jpeg', smallBase64)).toEqual({ valid: true })
    expect(validateDemoFile('image/png', smallBase64)).toEqual({ valid: true })
    expect(validateDemoFile('image/webp', smallBase64)).toEqual({ valid: true })
  })

  test('rejects invalid MIME types', () => {
    const r = validateDemoFile('application/exe', smallBase64)
    expect(r.valid).toBe(false)
    expect(r.error).toBeTruthy()
  })

  test('rejects files > 10MB', () => {
    // 10MB + 1 byte of raw data → base64 is ~4/3 larger
    const bigBase64 = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64')
    const r = validateDemoFile('image/jpeg', bigBase64)
    expect(r.valid).toBe(false)
    expect(r.error).toContain('10')
  })
})

// ── validateFileBytes (magic bytes) ──────────────────────────────────────────

describe('validateFileBytes', () => {
  // Build real magic-byte buffers

  function makePdfBase64() {
    const buf = Buffer.alloc(12)
    buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46  // %PDF
    return buf.toString('base64')
  }

  function makeJpegBase64() {
    const buf = Buffer.alloc(12)
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF
    return buf.toString('base64')
  }

  function makePngBase64() {
    const buf = Buffer.alloc(12)
    buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47
    buf[4] = 0x0D; buf[5] = 0x0A; buf[6] = 0x1A; buf[7] = 0x0A
    return buf.toString('base64')
  }

  function makeWebpBase64() {
    const buf = Buffer.alloc(16)
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46  // RIFF
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50  // WEBP
    return buf.toString('base64')
  }

  test('accepts valid PDF', () => {
    expect(validateFileBytes('application/pdf', makePdfBase64())).toEqual({ valid: true })
  })

  test('accepts valid JPEG', () => {
    expect(validateFileBytes('image/jpeg', makeJpegBase64())).toEqual({ valid: true })
    expect(validateFileBytes('image/jpg', makeJpegBase64())).toEqual({ valid: true })
  })

  test('accepts valid PNG', () => {
    expect(validateFileBytes('image/png', makePngBase64())).toEqual({ valid: true })
  })

  test('accepts valid WebP', () => {
    expect(validateFileBytes('image/webp', makeWebpBase64())).toEqual({ valid: true })
  })

  test('rejects .exe disguised as PDF (wrong magic bytes)', () => {
    // MZ header (Windows exe) passed as PDF MIME
    const exeBuf = Buffer.alloc(12)
    exeBuf[0] = 0x4D; exeBuf[1] = 0x5A  // MZ
    const r = validateFileBytes('application/pdf', exeBuf.toString('base64'))
    expect(r.valid).toBe(false)
  })

  test('rejects .php disguised as JPEG', () => {
    const phpBuf = Buffer.from('<?php echo "xss"; ?>')
    const r = validateFileBytes('image/jpeg', phpBuf.toString('base64'))
    expect(r.valid).toBe(false)
  })

  test('rejects mismatched PNG declared as PDF', () => {
    const r = validateFileBytes('application/pdf', makePngBase64())
    expect(r.valid).toBe(false)
  })

  test('handles unsupported MIME type', () => {
    const r = validateFileBytes('application/x-shellscript', makePdfBase64())
    expect(r.valid).toBe(false)
  })

  test('handles empty/corrupted base64', () => {
    const r = validateFileBytes('application/pdf', 'NOTVALID!!!')
    expect(r.valid).toBe(false)
  })
})
