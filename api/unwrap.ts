import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getRootKey, unwrap, ConfigError } from '../lib/crypto'
import { isAuthorized } from '../lib/auth'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!isAuthorized(req.headers.authorization)) return res.status(401).json({ error: 'unauthorized' })

  const { wrapped } = (req.body ?? {}) as { wrapped?: string }
  if (typeof wrapped !== 'string' || !wrapped) {
    return res.status(400).json({ error: 'wrapped (base64) is required' })
  }

  try {
    const plaintext = unwrap(wrapped, getRootKey())
    return res.status(200).json({ plaintext })
  } catch (err) {
    if (err instanceof ConfigError) return res.status(503).json({ error: err.message })
    // A tampered or wrong-key payload throws here too (GCM auth tag
    // mismatch) -- reported the same as any other unwrap failure, not
    // distinguished, so a caller can't use the error to probe the key.
    return res.status(400).json({ error: 'unwrap_failed' })
  }
}
