// Browser-side file validation — runs before upload to reject obviously
// corrupted files without wasting a network round trip. Mirrors the magic
// bytes check in lib/sanitize.js but operates on Uint8Array since Buffer
// isn't available in the browser.

const MAGIC_BYTES_CHECK = {
  'application/pdf': b => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  'image/jpeg':       b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/jpg':        b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png':        b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
                            b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A,
  'image/webp':       b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                            b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  'image/heic':       b => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  'image/heif':       b => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
}

// Browsers can rarely decode HEIC/HEIF via createImageBitmap (Safari can,
// Chrome/Firefox usually can't) — skip the dimension check for these to
// avoid false-positive rejections of valid files.
const DIMENSION_CHECKABLE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_IMAGE_DIMENSION = 12000

export async function validateFileClientSide(file) {
  if (file.size === 0) {
    return { valid: false, error: `Fichier vide : ${file.name}` }
  }

  const headBuf = await file.slice(0, 16).arrayBuffer()
  const head = new Uint8Array(headBuf)
  const magicCheck = MAGIC_BYTES_CHECK[file.type]
  if (magicCheck && !magicCheck(head)) {
    return { valid: false, error: `Fichier corrompu ou format invalide : ${file.name}` }
  }

  // Heuristic only (not a full PDF parse) — catches the common case of a
  // download interrupted mid-transfer, which almost always drops the
  // trailing %%EOF marker.
  if (file.type === 'application/pdf') {
    const tailSize = Math.min(1024, file.size)
    const tailBuf  = await file.slice(file.size - tailSize, file.size).arrayBuffer()
    const tail     = new TextDecoder('latin1').decode(tailBuf)
    if (!tail.includes('%%EOF')) {
      return { valid: false, error: `PDF tronqué ou illisible : ${file.name}` }
    }
  }

  if (DIMENSION_CHECKABLE_TYPES.has(file.type)) {
    try {
      const bitmap = await createImageBitmap(file)
      const { width, height } = bitmap
      bitmap.close?.()
      if (width === 0 || height === 0) {
        return { valid: false, error: `Image invalide (dimensions nulles) : ${file.name}` }
      }
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        return { valid: false, error: `Image trop grande (${width}×${height}) : ${file.name}` }
      }
    } catch {
      return { valid: false, error: `Image illisible ou corrompue : ${file.name}` }
    }
  }

  return { valid: true }
}
