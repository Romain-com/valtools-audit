'use client'
// Navbar globale — logo Valraiso + utilisateur connecté + déconnexion
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
      <a href="/dashboard" className="flex items-center gap-2.5 shrink-0">
        {/* Pictogramme "A" stylisé Valraiso */}
        <div className="w-8 h-8 bg-brand-orange rounded flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
            <path
              d="M12 3L2 19h4l2-4h8l2 4h4L12 3zm0 4.5L16 15H8l4-7.5z"
              fill="white"
            />
          </svg>
        </div>
        <span className="text-white font-bold text-base tracking-tight">
          val<span className="text-brand-orange">raiso</span>
        </span>
        <span className="text-white/30 text-sm font-normal ml-1 hidden sm:inline">
          / Audit Digital
        </span>
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
