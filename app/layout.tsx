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
        <Navbar userEmail={user?.email} />
        <main className="min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </body>
    </html>
  )
}
