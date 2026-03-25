import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { QRCodeSVG } from 'qrcode.react'

export function LoginPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tempToken, setTempToken] = useState<string | null>(null)
  const [otpauth, setOtpauth] = useState<string | null>(null)
  const navigate = useNavigate()
  const { refresh } = useAuth()

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Login failed')
      }
      const data = (await res.json()) as { tempToken: string }
      setTempToken(data.tempToken)
      setOtpauth((data as { otpauth?: string }).otpauth ?? null)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Verification failed')
      }
      await refresh()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    }
  }

  return (
    <section className="page login-page">
      <h1>Sign in</h1>
      {step === 1 && (
        <form onSubmit={handlePasswordSubmit} className="card">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Continue</button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={handleCodeSubmit} className="card">
          {otpauth ? (
            <>
              <p>Scan the QR code with your authenticator app, then enter the 6-digit code below.</p>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                <QRCodeSVG value={otpauth} size={192} />
              </div>
              <details>
                <summary>Can't scan? Show setup key</summary>
                <p style={{ marginTop: 8 }}>
                  If your app supports it, you can enter this TOTP URI manually:
                </p>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{otpauth}</pre>
              </details>
            </>
          ) : (
            <p>Enter the 6-digit code from your authenticator app.</p>
          )}
          <label>
            2FA code
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit">Verify</button>
        </form>
      )}
    </section>
  )
}

