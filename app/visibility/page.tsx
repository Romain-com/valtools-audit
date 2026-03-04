// Page — Score de visibilité digitale (destination ou lieu touristique)
// Server Component wrapper autour du composant client VisibilityView

import { Suspense } from 'react'
import VisibiliteTabNav from '@/components/layout/VisibiliteTabNav'
import VisibilityView from '@/components/visibility/VisibilityView'

export default function VisibilityPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <VisibiliteTabNav />
      <Suspense fallback={null}>
        <VisibilityView />
      </Suspense>
    </div>
  )
}
