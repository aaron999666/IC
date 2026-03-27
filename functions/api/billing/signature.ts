const encoder = new TextEncoder()

function normalizeHex(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function timingSafeEqualHex(left: string, right: string) {
  const normalizedLeft = normalizeHex(left)
  const normalizedRight = normalizeHex(right)

  if (!normalizedLeft || !normalizedRight || normalizedLeft.length !== normalizedRight.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < normalizedLeft.length; index += 1) {
    mismatch |= normalizedLeft.charCodeAt(index) ^ normalizedRight.charCodeAt(index)
  }

  return mismatch === 0
}

function normalizeTimestampToMs(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return value.length <= 10 ? numeric * 1000 : numeric
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function createHmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  return bytesToHex(
    await crypto.subtle.sign('HMAC', key, encoder.encode(message)),
  )
}

export async function verifyBillingSignature(
  secret: string,
  timestamp: string | null | undefined,
  signature: string | null | undefined,
  rawBody: string,
  maxAgeMs = 5 * 60 * 1000,
) {
  const normalizedSecret = secret.trim()
  const normalizedTimestamp = timestamp?.trim() ?? ''
  const normalizedSignature = signature?.trim() ?? ''

  if (!normalizedSecret || !normalizedTimestamp || !normalizedSignature) {
    return false
  }

  const timestampMs = normalizeTimestampToMs(normalizedTimestamp)
  if (timestampMs === null) {
    return false
  }

  if (Math.abs(Date.now() - timestampMs) > maxAgeMs) {
    return false
  }

  const expected = await createHmacHex(
    normalizedSecret,
    `${normalizedTimestamp}.${rawBody}`,
  )

  return timingSafeEqualHex(expected, normalizedSignature)
}
