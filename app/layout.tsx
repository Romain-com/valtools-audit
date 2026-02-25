// Layout racine — Navbar + session Supabase
import './globals.css'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'Valraiso — Audit Digital Destination',
  description: 'Outil d\'audit du potentiel de transformation digitale des destinations touristiques',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Récupération de l'utilisateur côté serveur
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="fr">
      <body className="bg-brand-bg min-h-screen">

        {/* ── Fond décoratif Valraiso — fixe, derrière tout le contenu ─────── */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-0" aria-hidden="true">

          {/* Chemin-plein — vague orange pleine, haut-droite */}
          <svg
            viewBox="0 0 1000 1323.23"
            className="absolute -top-32 -right-52 w-[520px] opacity-[0.055]"
            fill="#ff450b"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M994.49.04c-181.3,2.94-327.37,150.93-327.38,333.07,0,46.14,5.12,93.91-9.89,138.59-25.39,75.56-97.21,105.38-171.8,108.45-133.47,5.5-255.08,97.38-299.63,222.87-22.49,63.36-18.68,129.64-18.68,195.71l-.05,4.25c-2.26,90.4-76.19,156.7-167.07,156.7v163.55l5.36-.04c176.61-2.87,318.9-147.03,318.9-324.45,0-58.88-8.41-119.82,23.44-172.69,20.51-34.04,54.08-62.12,92.31-73.63,48.54-14.62,100.5-7.55,149.17-21.45,134.72-38.49,232.04-164.95,235-305.08.05-2.33.07-4.66.07-6.99v-85.77l.05-4.34c2.28-94.26,75.76-163.98,170.18-165.24h5.51V0l-5.51.04h.01Z"/>
          </svg>

          {/* Chemin-pointillé-orange — tracé pointillé, bas-gauche */}
          <svg
            viewBox="0 0 1729.36 2131.12"
            className="absolute -bottom-48 -left-36 w-[420px] opacity-[0.18]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M.05,2129.57c91.83,2.83,220-127,220-312.5,0-436,188.5-575.5,399.5-575.5s456.5-128,456.5-450c0-373.5,111-510,382.5-510,124.5,0,282-6.5,268.5-281.5"
              stroke="#ff450b"
              strokeDasharray="9 9"
              strokeWidth="3"
            />
          </svg>

        </div>

        <Navbar userEmail={user?.email} />
        <main className="relative z-10 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </body>
    </html>
  )
}
