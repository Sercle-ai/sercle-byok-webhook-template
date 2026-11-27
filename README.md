# Sercle BYOK Webhook (Vercel)

A small, auditable webhook you deploy to **your own** Vercel account so that
Sercle can encrypt your team's sensitive data under a key **you** hold —
Sercle never sees it, never stores it, and can't decrypt your data if you
later revoke access.

This is one option for Sercle's Bring Your Own Key (BYOK) feature,
alongside AWS/GCP/Azure key vaults. Pick this one if your team doesn't
already have a cloud account you'd rather use, or if you just want the
simplest, cheapest path: no IAM roles, no cloud console — a few minutes and
two values.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSercle-ai%2Fsercle-byok-webhook-template&env=ROOT_KEY,AUTH_TOKEN&envDescription=Two%20secrets%20this%20webhook%20needs.%20Generate%20with%20the%20commands%20in%20the%20README.&envLink=https%3A%2F%2Fgithub.com%2FSercle-ai%2Fsercle-byok-webhook-template%23setup&project-name=sercle-byok-webhook&repository-name=sercle-byok-webhook)

## How it works

Sercle holds a small "data key" that actually encrypts your team's records.
Instead of Sercle protecting that key itself, this webhook does — Sercle
only ever sends it here to be **wrapped** (encrypted) or **unwrapped**
(decrypted), using a root key that lives only in your Vercel project's
environment variables. The root key, and the data it protects, never leaves
your own infrastructure in a form anyone but you can read.

```
Sercle's servers                         Your Vercel project (this webhook)
───────────────                          ──────────────────────────────────
"wrap this data key"  ──POST /api/wrap──▶  encrypt with ROOT_KEY ──▶ wrapped
"unwrap this one"    ──POST /api/unwrap─▶  decrypt with ROOT_KEY ──▶ plaintext
```

Revoking access is immediate and entirely in your hands: delete the Vercel
project, rotate `ROOT_KEY`, or change `AUTH_TOKEN` — any of the three, and
Sercle can no longer decrypt anything protected by this key, starting with
the very next request.

## Setup

1. Click **Deploy with Vercel** above. It forks this template into your own
   Vercel account.
2. When prompted for environment variables, generate two values and paste
   them in:
   ```bash
   # ROOT_KEY -- the actual key that protects your data. Guard this like a password.
   openssl rand -base64 32

   # AUTH_TOKEN -- just proves a request is really from Sercle. Any random string works.
   openssl rand -hex 32
   ```
   **Mark both as "Sensitive"** in the environment variable form (there's a
   toggle next to the value field). Vercel does not do this by default --
   an env var added the normal way is stored in a form anyone with access
   to this Vercel project can read back from the dashboard or API. These
   two values are the whole point of this template; don't leave them
   readable. If you forget this step, you can fix it later in **Settings →
   Environment Variables**: delete the variable and re-add it with
   Sensitive turned on (editing in place doesn't retroactively protect it).
3. Finish the deploy. Note your project's URL — it looks like
   `https://sercle-byok-webhook-yourteam.vercel.app`.
4. **Turn off Vercel's Deployment Protection for this project.** Vercel
   enables this by default on new projects, and it sits in front of your
   webhook, not behind it — it answers every request with its own `401`
   and a redirect to Vercel's login page, before `AUTH_TOKEN` is ever
   checked. The failure is silent: your webhook's own code and logs look
   completely fine, because the request never reached them. In your
   Vercel project, go to **Settings → Deployment Protection** and set it
   to **Off** (or, if you'd rather leave it on, use Vercel's **Protection
   Bypass for Automation** and send that secret as an additional header —
   see [Vercel's docs](https://vercel.com/docs/deployment-protection) for
   the exact header name). `AUTH_TOKEN` is this webhook's real access
   control either way.
5. In Sercle, go to **Teams**, open your team, and find the **Bring Your
   Own Key** row. Click **Connect** and enter:
   - **Webhook URL**: the URL from step 3
   - **Auth token**: the `AUTH_TOKEN` value from step 2 (the *same* value —
     this is how Sercle authenticates to your webhook, not a separate secret)
6. Click **Test connection**, then **Save and generate key**. Sercle calls
   `GET /api/health` with that token to confirm `ROOT_KEY` is set correctly
   before relying on this webhook for anything real, then generates your
   team's key, wrapped under it. A **Run a test** button appears once
   connected — it encrypts and decrypts a value through your webhook end to
   end, so you can confirm the whole path works any time.

That's it — no cloud IAM, no console access to configure. Vercel's free
tier comfortably covers the request volume this generates.

## What Sercle can and can't do

- Sercle can ask this webhook to wrap or unwrap **one data key at a time**.
  It never asks for `ROOT_KEY` itself, and there's no endpoint that would
  hand it over even if asked (`/api/wrap` and `/api/unwrap` only ever
  accept and return a *data key*, encrypted or not).
- Sercle cannot read `ROOT_KEY` from Vercel's dashboard, your Vercel team's
  billing, or anywhere else — it's an environment variable scoped to a
  project only you control.
- If this webhook becomes unreachable (deleted, taken offline, `AUTH_TOKEN`
  changed), Sercle's next attempt to decrypt your data simply fails, with
  an error that says so — it does not fall back to any key Sercle controls.

## Endpoints

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/wrap` | `Authorization: Bearer <AUTH_TOKEN>` | `{ "plaintext": "<base64>" }` | `{ "wrapped": "<base64>" }` |
| `POST` | `/api/unwrap` | `Authorization: Bearer <AUTH_TOKEN>` | `{ "wrapped": "<base64>" }` | `{ "plaintext": "<base64>" }` |
| `GET` | `/api/health` | `Authorization: Bearer <AUTH_TOKEN>` | — | `{ "ok": true }` |

The wrap format is `base64(iv(12 bytes) || authTag(16 bytes) || ciphertext)`
— AES-256-GCM, nothing exotic. Read `lib/crypto.ts`; it's under 60 lines.

## A note on security, honestly stated

This is simpler to set up than an AWS/GCP/Azure key vault, and that
simplicity has a real trade-off: it relies on a long-lived shared secret
(`AUTH_TOKEN`) rather than a cloud provider's identity federation, where
access can be revoked by an IAM policy edit with no shared secret involved
at all. If your team already has, or is willing to set up, a cloud KMS,
that path gives a stronger access-revocation guarantee. This template is
for teams who want BYOK's privacy benefit without that setup cost, and are
comfortable with that trade-off.
