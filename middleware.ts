// Middleware Next.js — protection des routes et gestion de session Supabase
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirection racine → dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Vérification de session via Supabase
  const { supabaseResponse, user } = await updateSession(request)

  // Routes API — passer directement sans redirect (appels serveur-serveur sans cookies)
  if (pathname.startsWith('/api/')) {
    return supabaseResponse
  }

  // Routes publiques autorisées sans auth
  const publicRoutes = ['/login']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    // Non authentifié → redirect login avec callback URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    // Déjà connecté → redirect dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Toutes les routes sauf assets statiques et API Next.js internes
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
