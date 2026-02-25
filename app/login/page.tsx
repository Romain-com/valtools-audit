'use client'
// Page de connexion — Supabase Auth avec redirection post-login
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">

      {/* ── Fond décoratif — assets Valraiso ────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">

        {/* Chemin-plein.svg — vague orange pleine, haut-droite */}
        <svg
          viewBox="0 0 1000 1323.23"
          className="absolute -top-24 -right-48 w-[480px] opacity-[0.07]"
          fill="#ff450b"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M994.49.04c-181.3,2.94-327.37,150.93-327.38,333.07,0,46.14,5.12,93.91-9.89,138.59-25.39,75.56-97.21,105.38-171.8,108.45-133.47,5.5-255.08,97.38-299.63,222.87-22.49,63.36-18.68,129.64-18.68,195.71l-.05,4.25c-2.26,90.4-76.19,156.7-167.07,156.7v163.55l5.36-.04c176.61-2.87,318.9-147.03,318.9-324.45,0-58.88-8.41-119.82,23.44-172.69,20.51-34.04,54.08-62.12,92.31-73.63,48.54-14.62,100.5-7.55,149.17-21.45,134.72-38.49,232.04-164.95,235-305.08.05-2.33.07-4.66.07-6.99v-85.77l.05-4.34c2.28-94.26,75.76-163.98,170.18-165.24h5.51V0l-5.51.04h.01Z"/>
        </svg>

        {/* Chemin-pointillé-orange — tracé bas-gauche */}
        <svg
          viewBox="0 0 1729.36 2131.12"
          className="absolute -bottom-40 -left-32 w-[380px] opacity-25"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M.05,2129.57c91.83,2.83,220-127,220-312.5,0-436,188.5-575.5,399.5-575.5s456.5-128,456.5-450c0-373.5,111-510,382.5-510,124.5,0,282-6.5,268.5-281.5"
            stroke="#ff450b"
            strokeDasharray="9 9"
            strokeWidth="3"
          />
        </svg>
      </div>

      <div className="relative w-full max-w-md">

        {/* ── Logo centré — Logo-Valraiso-couleurs.svg ──────────────────────── */}
        <div className="flex justify-center mb-8">
          <svg
            viewBox="60 85 820 168"
            className="h-12 w-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Texte "Valraiso" — navy */}
            <path
              fill="#18152b"
              d="M340.59,241.25l46.61-86.92h-24.2l-22.23,44.13-22.62-44.13h-24.15l46.61,86.92ZM430.29,152.56c9.11,0,17.18,2.44,24.21,7.32v-5.55h18.98v86.92h-18.98v-7.29c-7.08,4.86-15.26,7.29-24.54,7.29-12.12,0-22.28-4.31-30.47-12.93-8.19-8.5-12.29-19.19-12.29-32.06,0-12.12,4.18-22.44,12.54-30.94,8.36-8.5,18.54-12.76,30.56-12.76ZM430.29,172.07c-7.18,0-12.99,2.28-17.44,6.83-4.45,4.56-6.68,10.44-6.68,17.64,0,7.74,2.17,13.85,6.51,18.36,4.45,4.56,10.32,6.83,17.61,6.83s13.21-2.25,17.61-6.76c4.39-4.5,6.59-10.52,6.59-18.04s-2.2-13.54-6.59-18.04c-4.45-4.56-10.32-6.83-17.61-6.83ZM508,241.25V92.24h-18.98v149.01h18.98ZM542.48,241.25v-46.08c0-15.92,5.17-23.89,15.5-23.89,3.43,0,6.94,1.32,10.53,3.95l8.68-17.7c-5.45-3.32-10.67-4.98-15.67-4.98-3.76,0-7.02.72-9.77,2.15-2.7,1.37-5.79,3.92-9.27,7.65v-8.02h-18.96v86.92h18.96ZM620.29,152.56c9.07,0,17.1,2.42,24.11,7.25v-5.48s18.98,0,18.98,0v39.53c.06,1.02.09,2.05.09,3.09s-.03,2.08-.09,3.09v41.21h-18.98v-7.22c-7.06,4.81-15.21,7.22-24.44,7.22-12.12,0-22.28-4.31-30.47-12.93-8.19-8.5-12.29-19.19-12.29-32.06,0-12.12,4.18-22.44,12.54-30.94,8.36-8.5,18.55-12.76,30.56-12.76ZM697.98,154.33v86.92h-18.98v-86.92h18.98ZM818.73,152.56c12.07,0,22.31,4.28,30.72,12.84,8.3,8.56,12.46,19.08,12.46,31.55s-4.18,23.13-12.54,31.63c-8.41,8.45-18.74,12.67-30.97,12.67s-22.28-4.31-30.47-12.93c-8.19-8.5-12.29-19.19-12.29-32.06,0-12.12,4.18-22.44,12.54-30.94,8.36-8.5,18.55-12.76,30.56-12.76ZM775.63,152.56v19.51c-11.29,0-20.47,7.91-20.75,18.7v.51s0,10.23,0,10.23c0,21.73-18.15,39.39-40.67,39.74h-.68s0-19.51,0-19.51h.68c11.73-.15,20.86-8.47,21.14-19.71v-.52s0-10.23,0-10.23c0-21.17,17.68-38.37,39.62-38.71h.67ZM620.29,172.07c-7.18,0-12.99,2.28-17.44,6.83-4.45,4.56-6.68,10.44-6.68,17.64,0,7.74,2.17,13.85,6.51,18.36,4.45,4.56,10.32,6.83,17.61,6.83s13.21-2.25,17.61-6.76c3.89-3.99,6.06-9.16,6.51-15.52v-5.04c-.44-6.36-2.61-11.53-6.51-15.52-4.45-4.56-10.32-6.83-17.61-6.83ZM818.73,172.07c-7.18,0-12.99,2.28-17.44,6.83-4.45,4.56-6.68,10.44-6.68,17.64,0,7.74,2.17,13.85,6.51,18.36,4.45,4.56,10.32,6.83,17.61,6.83s13.21-2.25,17.61-6.76c4.4-4.5,6.59-10.52,6.59-18.04s-2.2-13.54-6.59-18.04c-4.45-4.56-10.32-6.83-17.61-6.83ZM688.38,109.98c3.11,0,5.77,1.13,7.96,3.38,2.2,2.2,3.29,4.91,3.29,8.11s-1.1,5.93-3.29,8.19c-2.14,2.26-4.77,3.38-7.89,3.38s-5.77-1.13-7.96-3.38c-2.2-2.26-3.29-5.01-3.29-8.26s1.1-5.77,3.29-8.03c2.2-2.26,4.83-3.38,7.89-3.38Z"
            />
            {/* Icône "A" — orange */}
            <path
              fillRule="evenodd"
              fill="#ff450b"
              d="M138.09,241.25l69.45-120.63,9.92,17.09-59.53,103.54h-19.84ZM196.76,241.25l9.89-17.08,39.97-.11-19.86-34.95,9.88-17.04,29.66,51.94h.02s9.88,17.24,9.88,17.24h-79.42Z"
            />
          </svg>
        </div>

        <p className="text-center text-text-secondary text-sm -mt-5 mb-8">
          Audit Digital Destination
        </p>

        {/* Card formulaire */}
        <div className="card p-8 shadow-md">
          <h2 className="text-xl font-bold text-brand-navy mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-navy mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                autoFocus
                className="input-base"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-navy mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-base"
              />
            </div>

            {/* Erreur */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Bouton */}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        {/* Footer discret */}
        <p className="text-center text-text-muted text-xs mt-6">
          Outil interne Valraiso — accès restreint
        </p>
      </div>
    </div>
  )
}
