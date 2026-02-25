// Route Handler — création/mise à jour d'une destination et lancement d'audit
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface CommuneInput {
  nom: string
  code: string           // Code INSEE
  codesPostaux: string[]
  codeDepartement: string
  codeRegion: string
  population: number
  siren?: string
}

interface RequestBody {
  commune: CommuneInput
  forcer?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { commune, forcer = false } = body

    if (!commune?.code || !commune?.nom) {
      return NextResponse.json({ error: 'Données commune incomplètes' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // ── 1. Résolution SIREN via microservice si absent ────────────────────────
    let siren = commune.siren || ''
    if (!siren) {
      try {
        const baseUrl = process.env.DATA_TOURISME_API_URL || 'http://localhost:3001'
        const res = await fetch(`${baseUrl}/siren?insee=${commune.code}`)
        if (res.ok) {
          const data = await res.json()
          siren = data.siren || ''
        }
      } catch {
        // SIREN optionnel — on continue sans
      }
    }

    // Slug depuis le nom de la commune
    const slug = commune.nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // ── 2. UPSERT destination ─────────────────────────────────────────────────
    const destinationData = {
      nom: commune.nom,
      siren: siren || `insee-${commune.code}`, // Fallback si SIREN absent
      code_insee: commune.code,
      code_postal: commune.codesPostaux?.[0] || '',
      code_departement: commune.codeDepartement,
      code_region: commune.codeRegion,
      population: commune.population || 0,
      slug,
    }

    const { data: destination, error: destError } = await supabase
      .from('destinations')
      .upsert(destinationData, {
        onConflict: 'siren',
        ignoreDuplicates: false,
      })
      .select('id')
      .single()

    if (destError) {
      return NextResponse.json(
        { error: `Erreur création destination : ${destError.message}` },
        { status: 500 }
      )
    }

    const destinationId = destination.id

    // ── 3. Vérification audit existant ────────────────────────────────────────
    const { data: auditExistant } = await supabase
      .from('audits')
      .select('id')
      .eq('destination_id', destinationId)
      .maybeSingle()

    let auditId: string

    if (auditExistant && !forcer) {
      // Doublon non forcé — on retourne une erreur que le client gère
      return NextResponse.json(
        { error: 'doublon', auditId: auditExistant.id },
        { status: 409 }
      )
    }

    if (auditExistant) {
      // Relancement — reset de l'audit existant
      const { data: updated, error: updateError } = await supabase
        .from('audits')
        .update({
          statut: 'en_cours',
          resultats: {},
          couts_api: {},
          created_at: new Date().toISOString(),
        })
        .eq('id', auditExistant.id)
        .select('id')
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: `Erreur reset audit : ${updateError.message}` },
          { status: 500 }
        )
      }
      auditId = updated.id
    } else {
      // Nouvel audit
      const { data: newAudit, error: insertError } = await supabase
        .from('audits')
        .insert({
          destination_id: destinationId,
          statut: 'en_cours',
          resultats: {},
          couts_api: {},
        })
        .select('id')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: `Erreur création audit : ${insertError.message}` },
          { status: 500 }
        )
      }
      auditId = newAudit.id
    }

    return NextResponse.json({ auditId, destinationId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
