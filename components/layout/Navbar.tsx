'use client'
// Navbar globale — logo Valraiso officiel + utilisateur connecté + déconnexion
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavbarProps {
  userEmail?: string | null
}

export default function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="h-14 bg-brand-navy border-b border-white/10 flex items-center px-6 gap-4 sticky top-0 z-50">
      {/* Logo Valraiso */}
      <a href="/dashboard" className="flex items-center gap-3 shrink-0">

        {/* Icône — Icon-Valraiso.svg (fond crème + A orange) */}
        <svg viewBox="0 0 500 500" className="w-8 h-8 shrink-0" xmlns="http://www.w3.org/2000/svg">
          <rect width="500" height="500" rx="90.23" ry="90.23" fill="#fff7ee"/>
          <path
            fillRule="evenodd"
            fill="#ff450b"
            d="M109.02,358.75L250.83,119.09l20.26,33.95-121.55,205.71h-40.52ZM228.81,358.75l20.19-33.94,81.61-.21-40.55-69.44,20.16-33.87,60.55,103.2h.04s20.16,34.25,20.16,34.25h-162.17Z"
          />
        </svg>

        {/* Wordmark — Logo-Valraiso-blanc.svg (texte seul, sans l'icône) */}
        <svg
          viewBox="285 88 600 158"
          className="h-5 w-auto hidden sm:block"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#fff"
            d="M340.59,241.25l46.61-86.92h-24.2l-22.23,44.13-22.62-44.13h-24.15l46.61,86.92ZM430.29,152.56c9.11,0,17.18,2.44,24.21,7.32v-5.55h18.98v86.92h-18.98v-7.29c-7.08,4.86-15.26,7.29-24.54,7.29-12.12,0-22.28-4.31-30.47-12.93-8.19-8.5-12.29-19.19-12.29-32.06,0-12.12,4.18-22.44,12.54-30.94,8.36-8.5,18.54-12.76,30.56-12.76ZM430.29,172.07c-7.18,0-12.99,2.28-17.44,6.83-4.45,4.56-6.68,10.44-6.68,17.64,0,7.74,2.17,13.85,6.51,18.36,4.45,4.56,10.32,6.83,17.61,6.83s13.21-2.25,17.61-6.76c4.39-4.5,6.59-10.52,6.59-18.04s-2.2-13.54-6.59-18.04c-4.45-4.56-10.32-6.83-17.61-6.83ZM508,241.25V92.24h-18.98v149.01h18.98ZM542.48,241.25v-46.08c0-15.92,5.17-23.89,15.5-23.89,3.43,0,6.94,1.32,10.53,3.95l8.68-17.7c-5.45-3.32-10.67-4.98-15.67-4.98-3.76,0-7.02.72-9.77,2.15-2.7,1.37-5.79,3.92-9.27,7.65v-8.02h-18.96v86.92h18.96ZM620.29,152.56c9.07,0,17.1,2.42,24.11,7.25v-5.48s18.98,0,18.98,0v39.53c.06,1.02.09,2.05.09,3.09s-.03,2.08-.09,3.09v41.21h-18.98v-7.22c-7.06,4.81-15.21,7.22-24.44,7.22-12.12,0-22.28-4.31-30.47-12.93-8.19-8.5-12.29-19.19-12.29-32.06,0-12.12,4.18-22.44,12.54-30.94,8.36-8.5,18.55-12.76,30.56-12.76ZM697.98,154.33v86.92h-18.98v-86.92h18.98ZM818.73,152.56c12.07,0,22.31,4.28,30.72,12.84,8.3,8.56,12.46,19.08,12.46,31.55s-4.18,23.13-12.54,31.63c-8.41,8.45-18.74,12.67-30.97,12.67s-22.28-4.31-30.47-12.93c-8.19-8.5-12.29-19.19-12.29-32.06,0-12.12,4.18-22.44,12.54-30.94,8.36-8.5,18.55-12.76,30.56-12.76ZM775.63,152.56v19.51c-11.29,0-20.47,7.91-20.75,18.7v.51s0,10.23,0,10.23c0,21.73-18.15,39.39-40.67,39.74h-.68s0-19.51,0-19.51h.68c11.73-.15,20.86-8.47,21.14-19.71v-.52s0-10.23,0-10.23c0-21.17,17.68-38.37,39.62-38.71h.67ZM620.29,172.07c-7.18,0-12.99,2.28-17.44,6.83-4.45,4.56-6.68,10.44-6.68,17.64,0,7.74,2.17,13.85,6.51,18.36,4.45,4.56,10.32,6.83,17.61,6.83s13.21-2.25,17.61-6.76c3.89-3.99,6.06-9.16,6.51-15.52v-5.04c-.44-6.36-2.61-11.53-6.51-15.52-4.45-4.56-10.32-6.83-17.61-6.83ZM818.73,172.07c-7.18,0-12.99,2.28-17.44,6.83-4.45,4.56-6.68,10.44-6.68,17.64,0,7.74,2.17,13.85,6.51,18.36,4.45,4.56,10.32,6.83,17.61,6.83s13.21-2.25,17.61-6.76c4.4-4.5,6.59-10.52,6.59-18.04s-2.2-13.54-6.59-18.04c-4.45-4.56-10.32-6.83-17.61-6.83ZM688.38,109.98c3.11,0,5.77,1.13,7.96,3.38,2.2,2.2,3.29,4.91,3.29,8.11s-1.1,5.93-3.29,8.19c-2.14,2.26-4.77,3.38-7.89,3.38s-5.77-1.13-7.96-3.38c-2.2-2.26-3.29-5.01-3.29-8.26s1.1-5.77,3.29-8.03c2.2-2.26,4.83-3.38,7.89-3.38Z"
          />
        </svg>

        <span className="text-white/30 text-sm font-normal hidden sm:inline">/ Audit Digital</span>
      </a>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Utilisateur connecté */}
      {userEmail && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* Avatar initiales */}
            <div className="w-7 h-7 rounded-full bg-brand-purple flex items-center justify-center">
              <span className="text-white text-xs font-semibold uppercase">
                {userEmail.charAt(0)}
              </span>
            </div>
            <span className="text-white/70 text-sm hidden md:inline truncate max-w-[180px]">
              {userEmail}
            </span>
          </div>

          {/* Séparateur */}
          <div className="w-px h-5 bg-white/20" />

          {/* Bouton déconnexion */}
          <button
            onClick={handleSignOut}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors duration-150 flex items-center gap-1.5"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V5h10v10H4v-1a1 1 0 10-2 0v2a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm9.707 5.293a1 1 0 010 1.414L11.414 11H17a1 1 0 110 2H11.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      )}
    </nav>
  )
}
