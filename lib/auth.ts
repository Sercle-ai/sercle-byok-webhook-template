// Confirms a request actually came from Sercle (or at least from whoever
// holds AUTH_TOKEN -- the same value you pasted into Sercle's Team Settings
// when you connected this webhook).
//
// Constant-time compare: a plain `===` leaks how many leading characters
// matched through response timing, which is the one thing a bearer token
// comparison should never do.

import { timingSafeEqual } from 'node:crypto'

export function isAuthorized(authHeader: string | string[] | undefined): boolean {
  const expected = process.env.AUTH_TOKEN
  if (!expected) return false

  const provided = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (!provided?.startsWith('Bearer ')) return false
  const token = provided.slice('Bearer '.length)

  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  // Different-length buffers would throw inside timingSafeEqual, not fail
  // closed -- check length first, which only leaks the token's length, not
  // its content.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
