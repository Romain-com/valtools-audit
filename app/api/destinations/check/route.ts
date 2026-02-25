// Route Handler — vérification doublon avant lancement d'audit
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const insee = searchParams.get('insee')
  const siren = searchParams.get('siren')

  if (!insee && !siren) {
    return NextResponse.json({ error: 'Paramètre insee ou siren requis' }, { status: 400 })
  }

  try {
    const supabase = await createServiceClient()

    let query = supabase
      .from('destinations')
      .select(`
        id,
        nom,
        siren,
        audits (
          id,
          created_at,
          statut
        )
      `)
      .limit(1)

    if (insee) {
      query = query.eq('code_insee', insee)
    } else if (siren) {
      query = query.eq('siren', siren)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ existant: null })
    }

    // Récupération du dernier audit
    const auditList = (data as { audits?: Array<{ id: string; created_at: string; statut: string }> }).audits || []
    const dernierAudit = auditList.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    return NextResponse.json({
      existant: {
        id: data.id,
        nom: data.nom,
        siren: data.siren,
        audit: dernierAudit || null,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
