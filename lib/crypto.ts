// AES-256-GCM wrap/unwrap for a data-encrypting key (DEK) handed to us by
// Sercle. This deliberately matches the envelope format Sercle's own
// `secret-crypto.ts` uses (base64(iv || authTag || ciphertext)) -- same
// shape, independently implemented, so there is nothing novel to audit
// here beyond "is this AES-256-GCM done correctly."
//
// ROOT_KEY never leaves this function (and never leaves your own Vercel
// project's environment at all). Sercle only ever sends it a DEK to wrap
// or unwrap -- it has no way to ask for ROOT_KEY itself.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export class ConfigError extends Error {}

/** Reads and validates ROOT_KEY from the environment. Throws rather than
 *  silently operating with a wrong-length key. */
export function getRootKey(): Buffer {
  const raw = process.env.ROOT_KEY
  if (!raw) {
    throw new ConfigError('ROOT_KEY is not set. Generate one with `openssl rand -base64 32`.')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new ConfigError(`ROOT_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`)
  }
  return key
}

/** plaintext is the DEK Sercle wants wrapped, base64-encoded for transport.
 *  Returns base64(iv || authTag || ciphertext). */
export function wrap(plaintextBase64: string, key: Buffer): string {
  const plaintext = Buffer.from(plaintextBase64, 'base64')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

/** Inverse of wrap. Throws if the payload was tampered with or truncated. */
export function unwrap(wrappedBase64: string, key: Buffer): string {
  const buf = Buffer.from(wrappedBase64, 'base64')
  if (buf.length <= IV_BYTES + TAG_BYTES) {
    throw new Error('Wrapped payload is malformed or truncated')
  }
  const iv         = buf.subarray(0, IV_BYTES)
  const authTag    = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('base64')
}
