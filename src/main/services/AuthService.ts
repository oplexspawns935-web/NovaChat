import { app, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export type AuthUser = {
  email: string
  provider: 'otp' | 'google'
  name?: string | null
}

export type AuthSession = {
  user: AuthUser
  token: string
  createdAt: number
}

type PendingOtp = {
  email: string
  code: string
  expiresAt: number
}

export type AuthStatus = {
  signedIn: boolean
  user: AuthUser | null
  lastError: string | null
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function randomToken() {
  return randomBytes(24).toString('hex')
}

function base64Url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function sha256Base64Url(input: string) {
  const hash = createHash('sha256').update(input).digest()
  return base64Url(hash)
}

export class AuthService {
  private status: AuthStatus = { signedIn: false, user: null, lastError: null }
  private pending: PendingOtp | null = null

  private getSessionPath() {
    return join(app.getPath('userData'), 'auth-session.json')
  }

  private loadSession(): AuthSession | null {
    const p = this.getSessionPath()
    if (!existsSync(p)) return null
    try {
      const raw = readFileSync(p, 'utf-8')
      const data = JSON.parse(raw) as AuthSession
      if (!data?.user?.email || !data?.token) return null
      return data
    } catch {
      return null
    }
  }

  private saveSession(session: AuthSession | null) {
    const p = this.getSessionPath()
    if (!session) {
      try {
        writeFileSync(p, JSON.stringify({}), { encoding: 'utf-8' })
      } catch {
        // ignore
      }
      return
    }
    writeFileSync(p, JSON.stringify(session, null, 2), { encoding: 'utf-8' })
  }

  ensureInitialized() {
    const s = this.loadSession()
    if (s) {
      this.status = { signedIn: true, user: s.user, lastError: null }
    }
  }

  getStatus() {
    return this.status
  }

  signOut() {
    this.status = { signedIn: false, user: null, lastError: null }
    this.pending = null
    this.saveSession(null)
    return this.status
  }

  requestOtp(email: string) {
    const e = normalizeEmail(email)
    if (!e || !e.includes('@')) throw new Error('Enter a valid email')

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 10 * 60 * 1000

    this.pending = { email: e, code, expiresAt }

    // Dev mode: we return the OTP to display in-app.
    return { ok: true, devCode: code, expiresAt }
  }

  verifyOtp(email: string, code: string) {
    const e = normalizeEmail(email)
    const c = String(code || '').trim()
    if (!this.pending || this.pending.email !== e) throw new Error('No pending code for this email')
    if (Date.now() > this.pending.expiresAt) throw new Error('Code expired')
    if (c !== this.pending.code) throw new Error('Invalid code')

    const session: AuthSession = {
      user: { email: e, provider: 'otp' },
      token: randomToken(),
      createdAt: Date.now(),
    }

    this.pending = null
    this.saveSession(session)
    this.status = { signedIn: true, user: session.user, lastError: null }
    return { ok: true, session }
  }

  async connectGoogle(args: { clientId: string; scopes?: string[] }) {
    const clientId = String(args?.clientId || '').trim()
    if (!clientId) throw new Error('Google Client ID is required')

    const scopes = (args?.scopes?.length ? args.scopes : ['openid', 'email', 'profile']).join(' ')

    const verifier = base64Url(randomBytes(32))
    const challenge = sha256Base64Url(verifier)
    const state = base64Url(randomBytes(16))

    const server = createServer()

    const codePromise: Promise<string> = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Google sign-in timed out'))
        try {
          server.close()
        } catch {
          // ignore
        }
      }, 120000)

      server.on('request', (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://127.0.0.1')
          if (url.pathname !== '/callback') {
            res.writeHead(404)
            res.end('Not found')
            return
          }

          const returnedState = url.searchParams.get('state')
          const code = url.searchParams.get('code')
          const err = url.searchParams.get('error')

          if (err) {
            clearTimeout(timeout)
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.end('Sign-in cancelled. You can close this tab.')
            reject(new Error(err))
            return
          }

          if (!code || returnedState !== state) {
            clearTimeout(timeout)
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('Invalid sign-in response. You can close this tab.')
            reject(new Error('Invalid OAuth response'))
            return
          }

          clearTimeout(timeout)
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('Signed in successfully. You can close this tab and return to Nova Optimizer.')
          resolve(code)
        } catch (e: any) {
          reject(new Error(String(e?.message || e)))
        } finally {
          setTimeout(() => {
            try {
              server.close()
            } catch {
              // ignore
            }
          }, 50)
        }
      })
    })

    const preferredPort = 42813
    await new Promise<void>((resolve, reject) => {
      server.once('error', (e) => reject(e))
      server.listen(preferredPort, '127.0.0.1', () => resolve())
    })

    const redirectUri = `http://127.0.0.1:${preferredPort}/callback`

    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(challenge)}` +
      `&code_challenge_method=S256` +
      `&access_type=offline` +
      `&prompt=consent`

    await shell.openExternal(authUrl)

    const code = await codePromise

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const tokenJson: any = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok) {
      throw new Error(tokenJson?.error_description || tokenJson?.error || 'Google token exchange failed')
    }

    // Minimal user info via userinfo endpoint.
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })

    const info: any = await infoRes.json().catch(() => ({}))

    const email = normalizeEmail(info?.email)
    if (!email) throw new Error('Google did not return an email address')

    const session: AuthSession = {
      user: { email, provider: 'google', name: info?.name ?? null },
      token: randomToken(),
      createdAt: Date.now(),
    }

    this.saveSession(session)
    this.status = { signedIn: true, user: session.user, lastError: null }

    return { ok: true, session, tokens: tokenJson }
  }
}
