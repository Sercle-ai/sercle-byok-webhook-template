// What Sercle calls when you click "Test connection" after entering this
// webhook's URL and AUTH_TOKEN into Team Settings -- confirms ROOT_KEY is
// set and the right length before Sercle starts trusting it for real
// wrap/unwrap calls.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getRootKey, ConfigError } from '../lib/crypto'
import { isAuthorized } from '../lib/auth'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req.headers.authorization)) return res.status(401).json({ error: 'unauthorized' })

  try {
    getRootKey()
    return res.status(200).json({ ok: true })
  } catch (err) {
    if (err instanceof ConfigError) return res.status(503).json({ ok: false, error: err.message })
    return res.status(500).json({ ok: false, error: 'health_check_failed' })
  }
}
