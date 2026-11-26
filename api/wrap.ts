import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getRootKey, wrap, ConfigError } from '../lib/crypto'
import { isAuthorized } from '../lib/auth'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!isAuthorized(req.headers.authorization)) return res.status(401).json({ error: 'unauthorized' })

  const { plaintext } = (req.body ?? {}) as { plaintext?: string }
  if (typeof plaintext !== 'string' || !plaintext) {
    return res.status(400).json({ error: 'plaintext (base64) is required' })
  }

  try {
    const wrapped = wrap(plaintext, getRootKey())
    return res.status(200).json({ wrapped })
  } catch (err) {
    if (err instanceof ConfigError) return res.status(503).json({ error: err.message })
    return res.status(500).json({ error: 'wrap_failed' })
  }
}
