import React from 'react'
import { Card } from '../components/Card'
import { useSettings } from '../state/SettingsContext'

export function AuthPage() {
  const { settings, setSettings } = useSettings()
  const [status, setStatus] = React.useState<any>(null)
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [devCode, setDevCode] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const googleClientId = String(settings?.googleOAuthClientId || '')

  async function refresh() {
    const s = await window.netflux.getAuthStatus()
    setStatus(s)
  }

  React.useEffect(() => {
    refresh()
  }, [])

  async function sendCode() {
    setBusy(true)
    setError(null)
    setDevCode(null)
    try {
      const res = await window.netflux.requestOtp(email)
      setDevCode(res?.devCode ? String(res.devCode) : null)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setError(null)
    try {
      await window.netflux.verifyOtp(email, code)
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      await window.netflux.signOut()
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  async function connectGoogle() {
    setBusy(true)
    setError(null)
    try {
      await window.netflux.connectGoogle({ clientId: googleClientId })
      await refresh()
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card 
        title="Account Status"
        right={
          status?.signedIn ? (
            <button className="btn-ghost text-xs" onClick={signOut} disabled={busy}>
              Sign Out
            </button>
          ) : null
        }
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${status?.signedIn ? 'bg-neonBlue shadow-[0_0_8px_rgba(76,201,240,0.6)]' : 'bg-white/30'}`} />
            <div className="text-sm font-medium text-white/90">
              {status?.signedIn ? 'Signed in' : 'Signed out'}
            </div>
          </div>
          {status?.user?.email && (
            <div className="mt-3 text-xs text-white/50">
              <span className="text-white/70">{status.user.email}</span>
              {status.user.provider && (
                <span className="ml-2 text-neonPurple/80">• {status.user.provider}</span>
              )}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl bg-neonPink/10 border border-neonPink/20 px-4 py-3 text-xs text-neonPink">
              {error}
            </div>
          )}
        </div>
      </Card>

      <Card 
        title="Sign in with Google" 
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative space-y-4">
          <button 
            className="btn-primary w-full py-3.5" 
            onClick={connectGoogle} 
            disabled={busy || !googleClientId.trim()}
          >
            Continue with Google
          </button>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Google OAuth Client ID
            </label>
            <input
              value={googleClientId}
              onChange={(e) => setSettings({ googleOAuthClientId: e.target.value })}
              placeholder="Enter your Google OAuth Client ID"
              className="w-full rounded-2xl bg-black/25 px-4 py-3 text-sm outline-none ring-1 ring-white/12 transition-all focus:ring-neonPurple/50 focus:bg-black/35"
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Redirect URI
            </label>
            <div className="rounded-xl bg-black/20 px-4 py-3 font-mono text-[11px] text-white/70 ring-1 ring-white/10">
              http://127.0.0.1:42813/callback
            </div>
          </div>
        </div>
      </Card>

      <Card 
        title="Email Sign-in (Fallback)" 
        className="relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
        <div className="relative space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Email Address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-2xl bg-black/25 px-4 py-3 text-sm outline-none ring-1 ring-white/12 transition-all focus:ring-neonPink/50 focus:bg-black/35"
              disabled={busy}
            />
          </div>
          <button 
            className="btn-secondary w-full py-3" 
            onClick={sendCode} 
            disabled={busy}
          >
            Send Code
          </button>
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Verification Code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter the code sent to your email"
              className="w-full rounded-2xl bg-black/25 px-4 py-3 text-sm outline-none ring-1 ring-white/12 transition-all focus:ring-neonPink/50 focus:bg-black/35"
              disabled={busy}
            />
          </div>
          <button 
            className="btn-ghost w-full py-3" 
            onClick={verify} 
            disabled={busy}
          >
            Verify & Sign In
          </button>
          {devCode && (
            <div className="rounded-xl bg-neonBlue/10 border border-neonBlue/20 px-4 py-3 text-xs text-white/60">
              Dev OTP: <span className="font-mono font-semibold text-neonBlue">{devCode}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
