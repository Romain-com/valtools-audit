'use client'
// Composant client pour la page Résultats — sidebar + 7 blocs
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { AuditFull } from './page'
import ExpandableSection from '@/components/ui/ExpandableSection'
import CopyButton from '@/components/ui/CopyButton'
import StatusBadge from '@/components/ui/StatusBadge'
import KpiCard from '@/components/ui/KpiCard'
import CoutTooltip from '@/components/ui/CoutTooltip'

// ─── Types locaux raccourcis ─────────────────────────────────────────────────

type Resultats = Record<string, unknown>

// ─── Config sidebar blocs ────────────────────────────────────────────────────

const BLOCS = [
  { id: 'positionnement',   label: 'Positionnement',         icone: '🗺️', coutKey: 'bloc1' },
  { id: 'volume_affaires',  label: 'Volume d\'affaires',      icone: '💶', coutKey: 'bloc2' },
  { id: 'schema_digital',   label: 'Schéma digital',         icone: '🖥️', coutKey: 'bloc3' },
  { id: 'visibilite_seo',   label: 'Visibilité SEO',         icone: '🔍', coutKey: 'bloc4' },
  { id: 'stocks_physiques', label: 'Stocks physiques',       icone: '🏨', coutKey: 'bloc5' },
  { id: 'stock_en_ligne',   label: 'Stock en ligne',         icone: '🌐', coutKey: 'bloc6' },
  { id: 'concurrents',      label: 'Concurrents',            icone: '🏔️', coutKey: 'bloc7' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function get<T>(obj: unknown, path: string, fallback: T): T {
  const keys = path.split('.')
  let cur: unknown = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return fallback
    cur = (cur as Record<string, unknown>)[k]
  }
  return (cur ?? fallback) as T
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimals })
}

function calculerCoutBloc(couts: unknown, key: string): number {
  if (!couts || typeof couts !== 'object') return 0
  const bloc = (couts as Record<string, unknown>)[key]
  if (!bloc || typeof bloc !== 'object') return 0
  const t = (bloc as Record<string, number>).total ?? (bloc as Record<string, number>).total_bloc ?? 0
  return typeof t === 'number' ? t : 0
}

function calculerCoutTotal(couts: unknown): number {
  if (!couts || typeof couts !== 'object') return 0
  return Object.values(couts as Record<string, unknown>).reduce((sum: number, v) => {
    if (!v || typeof v !== 'object') return sum
    const t = (v as Record<string, number>).total ?? (v as Record<string, number>).total_bloc ?? 0
    return sum + (typeof t === 'number' ? t : 0)
  }, 0)
}

// ─── Composant Analyse OpenAI ─────────────────────────────────────────────────

function AnalyseBlock({ texte, titre = 'Analyse' }: { texte: string; titre?: string }) {
  if (!texte) return null
  return (
    <div className="mt-4 p-4 bg-brand-purple/5 border border-brand-purple/20 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-brand-purple uppercase tracking-wide">{titre}</span>
        <CopyButton text={texte} />
      </div>
      <p className="text-sm text-brand-navy leading-relaxed">{texte}</p>
    </div>
  )
}

// ─── Tableau générique ────────────────────────────────────────────────────────

function TableauSimple({ colonnes, lignes }: { colonnes: string[]; lignes: (string | number | null)[][] }) {
  if (!lignes.length) return <p className="text-sm text-text-muted italic">Aucune donnée</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-brand-bg">
            {colonnes.map((col, i) => (
              <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-text-secondary border-b border-brand-border">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            <tr key={i} className="border-b border-brand-border/50 hover:bg-brand-bg/50">
              {ligne.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-brand-navy">
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── BLOC 1 — Positionnement ─────────────────────────────────────────────────

function Bloc1({ r }: { r: Resultats }) {
  const noteOT = get<number | null>(r, 'positionnement.google.ot.note', null)
  const avisOT = get<number | null>(r, 'positionnement.google.ot.avis', null)
  const scoreSynthese = get<number | null>(r, 'positionnement.google.score_synthese', null)
  const postsCount = get<number | null>(r, 'positionnement.instagram.posts_count', null)
  const ratioOtUgc = get<string>( r, 'positionnement.instagram.ratio_ot_ugc', '—')
  const axe = get<string>(r, 'positionnement.positionnement.axe_principal', '')
  const forces = get<string[]>(r, 'positionnement.positionnement.forces_faiblesses.forces', [])
  const faiblesses = get<string[]>(r, 'positionnement.positionnement.forces_faiblesses.faiblesses', [])
  const paragraphe = get<string>(r, 'positionnement.positionnement.paragraphe_gdoc', '')
  const postsRecents = get<Array<{ username: string; likes: number; caption: string; timestamp: string }>>(
    r, 'positionnement.instagram.posts_recents', []
  )
  const nomOT = get<string>(r, 'positionnement.google.ot.nom', '')
  const adresseOT = get<string>(r, 'positionnement.google.ot.adresse', '')
  const otAbsent = get<boolean>(r, 'positionnement.google.ot.absent', false)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Note Google OT"
          value={noteOT?.toFixed(1) ?? '—'}
          unit={avisOT ? `(${fmt(avisOT)} avis)` : undefined}
          gaugeValue={noteOT ? noteOT / 5 : null}
          thresholds={{ high: 0.84, medium: 0.76 }}
          icon={<span>⭐</span>}
        />
        <KpiCard
          label="Score Maps"
          value={scoreSynthese?.toFixed(2) ?? '—'}
          unit="/5"
          gaugeValue={scoreSynthese ? scoreSynthese / 5 : null}
          thresholds={{ high: 0.84, medium: 0.76 }}
        />
        <KpiCard
          label="Posts Instagram"
          value={postsCount ? `${(postsCount / 1000000).toFixed(1)}M` : '—'}
          icon={<span>📷</span>}
        />
        <KpiCard
          label="Ratio OT/UGC"
          value={ratioOtUgc}
          subtitle="Posts OT / posts UGC"
        />
      </div>

      {/* Détail dépliable */}
      <ExpandableSection title="Fiche Google Maps OT + POI">
        {otAbsent ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            ⚠️ Fiche Google Maps de l'OT absente ou introuvable.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-brand-bg rounded-lg">
              <p className="font-semibold text-brand-navy">{nomOT || '—'}</p>
              <p className="text-sm text-text-secondary">{adresseOT}</p>
              {noteOT && (
                <p className="text-sm mt-1">
                  <span className="text-brand-yellow">{'★'.repeat(Math.round(noteOT))}</span>{' '}
                  <span className="text-brand-navy font-semibold">{noteOT.toFixed(1)}</span>
                  {avisOT && <span className="text-text-muted"> — {fmt(avisOT)} avis</span>}
                </p>
              )}
            </div>
          </div>
        )}
      </ExpandableSection>

      <ExpandableSection title={`Posts Instagram récents (${postsRecents.length})`}>
        {postsRecents.length === 0 ? (
          <p className="text-sm text-text-muted italic">Aucun post récupéré</p>
        ) : (
          <div className="space-y-2">
            {postsRecents.map((post, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-brand-bg rounded-lg text-sm">
                <div className="w-7 h-7 rounded-full bg-brand-purple/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand-purple">
                    {post.username?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-brand-navy">@{post.username}</span>
                  <p className="text-text-secondary truncate mt-0.5">{post.caption}</p>
                </div>
                <span className="text-text-muted shrink-0">❤️ {fmt(post.likes)}</span>
              </div>
            ))}
          </div>
        )}
      </ExpandableSection>

      <ExpandableSection title="Positionnement & forces/faiblesses">
        {axe && <p className="font-semibold text-brand-navy mb-3">{axe}</p>}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-status-success mb-2">Forces</p>
            <ul className="space-y-1">
              {forces.map((f, i) => <li key={i} className="flex gap-2"><span>✅</span>{f}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-medium text-status-error mb-2">Faiblesses</p>
            <ul className="space-y-1">
              {faiblesses.map((f, i) => <li key={i} className="flex gap-2"><span>⚠️</span>{f}</li>)}
            </ul>
          </div>
        </div>
      </ExpandableSection>

      <AnalyseBlock texte={paragraphe} titre="Analyse positionnement" />
    </div>
  )
}

// ─── BLOC 2 — Volume d'affaires ───────────────────────────────────────────────

function Bloc2({ r }: { r: Resultats }) {
  const montantTS = get<number | null>(r, 'volume_affaires.collecteur.montant_taxe_euros', null)
  const nuitees = get<number | null>(r, 'volume_affaires.collecteur.nuitees_estimees', null)
  const typeCollecteur = get<string>(r, 'volume_affaires.collecteur.type_collecteur', '—')
  const nomCollecteur = get<string>(r, 'volume_affaires.collecteur.nom', '—')
  const partPct = get<number | null>(r, 'volume_affaires.part_commune_estimee.pourcentage', null)
  const synthese = get<string>(r, 'volume_affaires.openai.synthese_volume', '')
  const communes = get<Array<{ nom: string; ts_estimee: number; part_pct: number }>>(
    r, 'volume_affaires.dispatch_ts.communes', []
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Taxe de séjour"
          value={montantTS ? `${(montantTS / 1000000).toFixed(2)}M` : '—'}
          unit="€"
          icon={<span>💶</span>}
        />
        <KpiCard
          label="Nuitées estimées"
          value={nuitees ? fmt(nuitees) : '—'}
          subtitle="à 1,50€ taux moyen"
        />
        <KpiCard
          label="Type collecteur"
          value={typeCollecteur.toUpperCase()}
          subtitle={nomCollecteur}
        />
        {partPct !== null && (
          <KpiCard
            label="Part commune"
            value={`${partPct.toFixed(1)}%`}
            gaugeValue={partPct / 100}
            thresholds={{ high: 0.5, medium: 0.2 }}
          />
        )}
      </div>

      {communes.length > 0 && (
        <ExpandableSection title={`Dispatch taxe de séjour EPCI (${communes.length} communes)`}>
          <TableauSimple
            colonnes={['Commune', 'Part (%)', 'TS estimée (€)']}
            lignes={communes.slice(0, 10).map(c => [c.nom, `${c.part_pct?.toFixed(1)}%`, fmt(Math.round(c.ts_estimee))])}
          />
        </ExpandableSection>
      )}

      <AnalyseBlock texte={synthese} titre="Analyse volume d'affaires" />
    </div>
  )
}

// ─── BLOC 3 — Schéma digital ─────────────────────────────────────────────────

function Bloc3({ r }: { r: Resultats }) {
  const scoreVisibilite = get<number | null>(r, 'schema_digital.meta.score_visibilite_ot', null)
  const domaine = get<string>(r, 'schema_digital.domaine_ot_detecte', '—')
  const haloscan = get<Array<{ domaine: string; total_keywords: number; total_traffic: number; top_3_positions: number; site_non_indexe: boolean }>>(
    r, 'schema_digital.haloscan', []
  )
  const pagespeed = get<Array<{ domaine: string; mobile: { score: number }; desktop: { score: number } }>>(
    r, 'schema_digital.pagespeed', []
  )
  const niveauMaturite = get<string>(r, 'schema_digital.analyse_site_ot.niveau_maturite_digital', '—')
  const serp = get<Array<{ position: number; domaine: string; titre: string; categorie: string }>>(
    r, 'schema_digital.serp_fusionne', []
  )
  const fonctionnalites = get<Record<string, boolean | string>>(
    r, 'schema_digital.analyse_site_ot.fonctionnalites_detectees', {}
  )
  const synthese = get<string>(r, 'schema_digital.openai.synthese_schema', '')

  const ps = pagespeed[0]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Visibilité OT"
          value={scoreVisibilite !== null ? `${scoreVisibilite}/5` : '—'}
          gaugeValue={scoreVisibilite !== null ? scoreVisibilite / 5 : null}
          thresholds={{ high: 0.6, medium: 0.4 }}
          subtitle={domaine}
        />
        <KpiCard
          label="PageSpeed mobile"
          value={ps?.mobile?.score ?? '—'}
          unit="/100"
          gaugeValue={ps?.mobile?.score ? ps.mobile.score / 100 : null}
          thresholds={{ high: 0.7, medium: 0.5 }}
          icon={<span>📱</span>}
        />
        <KpiCard
          label="PageSpeed desktop"
          value={ps?.desktop?.score ?? '—'}
          unit="/100"
          gaugeValue={ps?.desktop?.score ? ps.desktop.score / 100 : null}
          thresholds={{ high: 0.7, medium: 0.5 }}
        />
        <KpiCard
          label="Maturité digitale"
          value={niveauMaturite === 'avance' ? 'Avancé' : niveauMaturite === 'moyen' ? 'Moyen' : 'Faible'}
          gaugeValue={niveauMaturite === 'avance' ? 0.85 : niveauMaturite === 'moyen' ? 0.5 : 0.2}
          thresholds={{ high: 0.7, medium: 0.4 }}
        />
      </div>

      {haloscan.length > 0 && (
        <ExpandableSection title="Métriques SEO Haloscan">
          <TableauSimple
            colonnes={['Domaine', 'Keywords', 'Trafic', 'Top 3', 'Indexé']}
            lignes={haloscan.map(h => [
              h.domaine,
              fmt(h.total_keywords),
              fmt(h.total_traffic),
              fmt(h.top_3_positions),
              h.site_non_indexe ? '❌' : '✅',
            ])}
          />
        </ExpandableSection>
      )}

      {Object.keys(fonctionnalites).length > 0 && (
        <ExpandableSection title="Fonctionnalités site OT">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(fonctionnalites).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 p-2 bg-brand-bg rounded">
                <span>{v === true ? '✅' : v === false ? '❌' : '❓'}</span>
                <span className="text-brand-navy capitalize">{k.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {serp.length > 0 && (
        <ExpandableSection title={`Résultats SERP fusionnés (${serp.length} entrées)`}>
          <TableauSimple
            colonnes={['#', 'Domaine', 'Titre', 'Catégorie']}
            lignes={serp.slice(0, 15).map(s => [s.position, s.domaine, s.titre?.slice(0, 50) + (s.titre?.length > 50 ? '…' : ''), s.categorie])}
          />
        </ExpandableSection>
      )}

      <AnalyseBlock texte={synthese} titre="Analyse schéma digital" />
    </div>
  )
}

// ─── BLOC 4 — Visibilité SEO ──────────────────────────────────────────────────

function Bloc4({ r }: { r: Resultats }) {
  const scoreGap = get<number | null>(r, 'visibilite_seo.phase_b.score_gap', null)
  const tauxCaptation = get<number | null>(r, 'visibilite_seo.phase_b.taux_captation', null)
  const volumeMarche = get<number | null>(r, 'visibilite_seo.phase_a.volume_marche_seeds', null)
  const phaseAStatut = get<string>(r, 'visibilite_seo.phase_a.statut', '')
  const phaseBStatut = get<string>(r, 'visibilite_seo.phase_b.statut', '')
  const top5 = get<Array<{ keyword: string; volume: number; categorie: string; position_ot: number | null }>>(
    r, 'visibilite_seo.phase_b.top_5_opportunites', []
  )
  const keywordsClasses = get<Array<{ keyword: string; volume: number; categorie: string; gap: boolean }>>(
    r, 'visibilite_seo.phase_a.keywords_classes', []
  )
  const synthese = get<string>(r, 'visibilite_seo.phase_b.synthese_narrative', '')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Score gap"
          value={scoreGap !== null ? `${scoreGap}/10` : '—'}
          gaugeValue={scoreGap !== null ? scoreGap / 10 : null}
          thresholds={{ high: 0.7, medium: 0.4 }}
          icon={<span>📊</span>}
        />
        <KpiCard
          label="Taux captation"
          value={tauxCaptation !== null ? `${tauxCaptation.toFixed(0)}%` : '—'}
          gaugeValue={tauxCaptation !== null ? tauxCaptation / 100 : null}
          thresholds={{ high: 0.6, medium: 0.3 }}
        />
        <KpiCard
          label="Volume marché"
          value={volumeMarche ? fmt(volumeMarche) : '—'}
          subtitle="recherches/mois (seeds)"
        />
        <KpiCard
          label="Top 5 opportunités"
          value={top5.length}
          subtitle="keywords prioritaires"
        />
      </div>

      {phaseAStatut === 'en_attente_validation' && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-lg">
          <span className="text-amber-600">⚠️</span>
          <p className="text-sm text-amber-800 flex-1">Phase B non lancée — validation requise</p>
        </div>
      )}

      {top5.length > 0 && (
        <ExpandableSection title="Top 5 opportunités SEO" defaultOpen={true}>
          <TableauSimple
            colonnes={['Keyword', 'Volume', 'Catégorie', 'Position OT']}
            lignes={top5.map(k => [k.keyword, fmt(k.volume), k.categorie, k.position_ot ?? 'Absent'])}
          />
        </ExpandableSection>
      )}

      {keywordsClasses.length > 0 && (
        <ExpandableSection title={`Keywords classifiés Phase A (${keywordsClasses.length})`}>
          <TableauSimple
            colonnes={['Keyword', 'Volume', 'Catégorie', 'Gap']}
            lignes={keywordsClasses.slice(0, 20).map(k => [k.keyword, fmt(k.volume), k.categorie, k.gap ? '🎯 OUI' : '—'])}
          />
        </ExpandableSection>
      )}

      <AnalyseBlock texte={synthese} titre="Analyse visibilité SEO" />
    </div>
  )
}

// ─── BLOC 5 — Stocks physiques ────────────────────────────────────────────────

function Bloc5({ r }: { r: Resultats }) {
  const totalStock = get<number | null>(r, 'stocks_physiques.stocks.total_stock_physique', null)
  const couvertureGlobal = get<number | null>(r, 'stocks_physiques.stocks.couverture.global', null)
  const ratioParticuliers = get<number | null>(r, 'stocks_physiques.stocks.ratio_particuliers_hebergement', null)
  const hebtotal = get<number | null>(r, 'stocks_physiques.stocks.hebergements.total_unique', null)
  const actTotal = get<number | null>(r, 'stocks_physiques.stocks.activites.total_unique', null)
  const cultureTotal = get<number | null>(r, 'stocks_physiques.stocks.culture.total_unique', null)
  const servicesTotal = get<number | null>(r, 'stocks_physiques.stocks.services.total_unique', null)
  const synthese = get<string>(r, 'stocks_physiques.synthese.synthese_narrative', '')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total stock" value={fmt(totalStock)} subtitle="héb + act + culture + services" icon={<span>📦</span>} />
        <KpiCard
          label="Couverture DT"
          value={couvertureGlobal !== null ? `${couvertureGlobal.toFixed(1)}%` : '—'}
          gaugeValue={couvertureGlobal !== null ? couvertureGlobal / 100 : null}
          thresholds={{ high: 0.1, medium: 0.05 }}
        />
        <KpiCard
          label="Ratio particuliers"
          value={ratioParticuliers !== null ? `${ratioParticuliers.toFixed(1)}%` : '—'}
          subtitle="hébergements meublés"
        />
        <KpiCard label="Hébergements" value={fmt(hebtotal)} />
      </div>

      <ExpandableSection title="Répartition par catégorie">
        <TableauSimple
          colonnes={['Catégorie', 'Total unique']}
          lignes={[
            ['Hébergements', fmt(hebtotal)],
            ['Activités', fmt(actTotal)],
            ['Culture', fmt(cultureTotal)],
            ['Services', fmt(servicesTotal)],
          ]}
        />
      </ExpandableSection>

      <AnalyseBlock texte={synthese} titre="Analyse stocks physiques" />
    </div>
  )
}

// ─── BLOC 6 — Stock en ligne ──────────────────────────────────────────────────

function Bloc6({ r }: { r: Resultats }) {
  const airbnbTotal = get<number | null>(r, 'stock_en_ligne.airbnb.total_annonces', null)
  const bookingTotal = get<number | null>(r, 'stock_en_ligne.booking.total_proprietes', null)
  const tauxDependance = get<number | null>(r, 'stock_en_ligne.indicateurs.taux_dependance_ota', null)
  const tauxDirect = get<number | null>(r, 'stock_en_ligne.indicateurs.taux_reservable_direct', null)
  const diagnostic = get<string>(r, 'stock_en_ligne.synthese.diagnostic', '')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Airbnb" value={airbnbTotal !== null ? fmt(airbnbTotal) : '—'} subtitle="annonces" icon={<span>🏠</span>} />
        <KpiCard label="Booking" value={bookingTotal !== null ? fmt(bookingTotal) : '—'} subtitle="propriétés" />
        <KpiCard
          label="Dépendance OTA"
          value={tauxDependance !== null ? `${tauxDependance.toFixed(1)}x` : '—'}
          subtitle="ratio OTA / stock DT"
          gaugeValue={tauxDependance !== null ? Math.min(tauxDependance / 20, 1) : null}
          thresholds={{ high: 0.7, medium: 0.4 }}
        />
        <KpiCard
          label="Réservable direct"
          value={tauxDirect !== null ? `${(tauxDirect * 100).toFixed(1)}%` : '—'}
          subtitle="fiches OT réservables"
        />
      </div>

      <div className="p-3 bg-brand-bg rounded-lg border border-brand-border text-xs text-text-muted">
        ⚠️ Viator toujours 0 — bloqué par Cloudflare (limitation connue)
      </div>

      <AnalyseBlock texte={diagnostic} titre="Analyse stock en ligne" />
    </div>
  )
}

// ─── BLOC 7 — Concurrents ─────────────────────────────────────────────────────

function Bloc7({ r }: { r: Resultats }) {
  const positionGlobale = get<string>(r, 'concurrents.synthese.position_globale', '')
  const concurrents = get<Array<{
    nom: string
    metriques: { total_keywords: number; total_traffic: number; note_google: number | null; site_non_indexe: boolean; source_seo: string }
  }>>(r, 'concurrents.phase_a.concurrents', [])
  const destCible = get<{ nom: string; total_keywords: number; total_traffic: number; note_google: number }>(
    r, 'concurrents.tableau_comparatif.destination_cible', { nom: '', total_keywords: 0, total_traffic: 0, note_google: 0 }
  )
  const opportunite = get<string>(r, 'concurrents.synthese.opportunite_cle', '')
  const resume = get<string>(r, 'concurrents.synthese.resume', '')

  const BADGE_POSITION: Record<string, { label: string; classes: string }> = {
    leader: { label: '🏆 LEADER', classes: 'bg-green-100 text-green-700 border-green-300' },
    dans_la_moyenne: { label: '📊 DANS LA MOYENNE', classes: 'bg-blue-100 text-blue-700 border-blue-300' },
    en_retard: { label: '⚠️ EN RETARD', classes: 'bg-red-100 text-red-700 border-red-300' },
  }

  const badgeConfig = positionGlobale ? BADGE_POSITION[positionGlobale] : null

  return (
    <div className="space-y-4">
      {badgeConfig && (
        <div className={`inline-flex items-center px-4 py-2 rounded-full border font-bold text-sm ${badgeConfig.classes}`}>
          {badgeConfig.label}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Keywords vs meilleur" value={destCible.total_keywords ? fmt(destCible.total_keywords) : '—'} icon={<span>🔑</span>} />
        <KpiCard label="Trafic estimé" value={destCible.total_traffic ? fmt(destCible.total_traffic) : '—'} />
        <KpiCard
          label="Note Google"
          value={destCible.note_google?.toFixed(1) ?? '—'}
          unit="/5"
          gaugeValue={destCible.note_google ? destCible.note_google / 5 : null}
          thresholds={{ high: 0.84, medium: 0.76 }}
        />
      </div>

      {concurrents.length > 0 && (
        <ExpandableSection title={`Tableau comparatif — ${concurrents.length} concurrents`} defaultOpen={true}>
          <TableauSimple
            colonnes={['Concurrent', 'Keywords', 'Trafic', 'Note Google', 'Indexé', 'Source SEO']}
            lignes={concurrents.map(c => [
              c.nom,
              fmt(c.metriques?.total_keywords),
              fmt(c.metriques?.total_traffic),
              c.metriques?.note_google?.toFixed(1) ?? '—',
              c.metriques?.site_non_indexe ? '❌' : '✅',
              c.metriques?.source_seo || '—',
            ])}
          />
        </ExpandableSection>
      )}

      {opportunite && (
        <div className="p-4 bg-brand-orange/5 border border-brand-orange/20 rounded-lg">
          <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide mb-1">Opportunité clé</p>
          <p className="text-sm text-brand-navy">{opportunite}</p>
        </div>
      )}

      <AnalyseBlock texte={resume} titre="Analyse concurrents" />
    </div>
  )
}

// ─── Tableau des coûts API ────────────────────────────────────────────────────

function OngletCouts({ couts }: { couts: Record<string, unknown> }) {
  const coutTotal = calculerCoutTotal(couts)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-brand-navy">Détail des coûts API</h3>
        <span className="font-mono font-bold text-lg text-brand-navy">{coutTotal.toFixed(3)} €</span>
      </div>

      {Object.entries(couts).map(([blocKey, blocData]) => {
        if (!blocData || typeof blocData !== 'object') return null
        const total = (blocData as Record<string, number>).total ?? (blocData as Record<string, number>).total_bloc ?? 0
        const entries = Object.entries(blocData as Record<string, unknown>).filter(
          ([k]) => k !== 'total' && k !== 'total_bloc'
        )

        return (
          <div key={blocKey} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-brand-navy capitalize">{blocKey.replace('_', ' ')}</span>
              <span className="font-mono text-sm">{Number(total).toFixed(3)} €</span>
            </div>
            {entries.length > 0 && (
              <div className="text-xs text-text-secondary space-y-1">
                {entries.map(([api, data]) => (
                  <div key={api} className="flex justify-between">
                    <span className="font-mono text-text-muted">{api}</span>
                    <span>
                      {typeof data === 'object' && data !== null
                        ? `${(data as Record<string, number>).nb_appels ?? '—'} appels — ${Number((data as Record<string, number>).cout_total ?? (data as Record<string, number>).cout ?? data).toFixed(3)} €`
                        : `${Number(data).toFixed(3)} €`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Composant Bloc résultat générique ───────────────────────────────────────

const BLOC_RENDERERS: Record<string, (r: Resultats) => React.ReactNode> = {
  positionnement:   (r) => <Bloc1 r={r} />,
  volume_affaires:  (r) => <Bloc2 r={r} />,
  schema_digital:   (r) => <Bloc3 r={r} />,
  visibilite_seo:   (r) => <Bloc4 r={r} />,
  stocks_physiques: (r) => <Bloc5 r={r} />,
  stock_en_ligne:   (r) => <Bloc6 r={r} />,
  concurrents:      (r) => <Bloc7 r={r} />,
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function ResultatsClient({ audit }: { audit: AuditFull }) {
  const [activeBloc, setActiveBloc] = useState('positionnement')
  const [showCouts, setShowCouts] = useState(false)
  const sectionsRef = useRef<Record<string, HTMLElement>>({})

  const resultats = audit.resultats as Resultats
  const couts = audit.couts_api as Record<string, unknown>
  const dest = audit.destinations

  // ── Scroll spy ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          // Prend le premier visible
          const id = visible[0].target.id.replace('bloc-', '')
          if (id) setActiveBloc(id)
        }
      },
      { threshold: 0.3, rootMargin: '-60px 0px -60% 0px' }
    )

    Object.values(sectionsRef.current).forEach(el => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  function scrollToBloc(blocId: string) {
    const el = sectionsRef.current[blocId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setActiveBloc(blocId)
  }

  const coutTotal = calculerCoutTotal(couts)
  const dateAudit = new Date(audit.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ── Sidebar gauche ─────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-white border-r border-brand-border flex flex-col overflow-y-auto">
        {/* En-tête sidebar */}
        <div className="p-4 border-b border-brand-border">
          <Link
            href="/dashboard"
            className="text-xs text-text-secondary hover:text-brand-orange transition-colors flex items-center gap-1 mb-1"
          >
            ← Dashboard
          </Link>
          <Link
            href={`/audit/${audit.id}/progression`}
            className="text-xs text-text-secondary hover:text-brand-orange transition-colors flex items-center gap-1 mb-2"
          >
            ← Progression
          </Link>
          <h2 className="font-bold text-brand-navy text-sm leading-tight">{dest.nom}</h2>
          <p className="text-xs text-text-muted mt-0.5">Dép. {dest.code_departement} — {dateAudit}</p>
          <div className="mt-2">
            <StatusBadge statut={audit.statut as 'termine'} size="sm" />
          </div>
        </div>

        {/* Navigation blocs */}
        <nav className="flex-1 p-2">
          {BLOCS.map((bloc, i) => {
            const hasData = !!resultats?.[bloc.id]
            const coutBloc = calculerCoutBloc(couts, bloc.coutKey)
            const isActive = activeBloc === bloc.id

            return (
              <button
                key={bloc.id}
                onClick={() => scrollToBloc(bloc.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-0.5 ${
                  isActive
                    ? 'bg-brand-orange/10 text-brand-orange font-semibold'
                    : 'text-text-secondary hover:bg-brand-bg hover:text-brand-navy'
                }`}
              >
                <span className="text-sm">{bloc.icone}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs block truncate">{i + 1}. {bloc.label}</span>
                </div>
                {coutBloc > 0 && <CoutTooltip cout={coutBloc} />}
                {hasData && (
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success shrink-0" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Onglet coûts */}
        <div className="p-2 border-t border-brand-border">
          <button
            onClick={() => setShowCouts(!showCouts)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
              showCouts
                ? 'bg-brand-navy text-white'
                : 'text-text-secondary hover:bg-brand-bg hover:text-brand-navy'
            }`}
          >
            <span>💰</span>
            <span>Coûts API</span>
            <span className="ml-auto font-mono font-semibold">{coutTotal.toFixed(3)} €</span>
            <CoutTooltip cout={coutTotal} label="Total" />
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        {showCouts ? (
          /* Onglet coûts */
          <div className="max-w-2xl mx-auto px-6 py-8">
            <button
              onClick={() => setShowCouts(false)}
              className="text-sm text-text-secondary hover:text-brand-orange transition-colors mb-6 flex items-center gap-1"
            >
              ← Retour aux résultats
            </button>
            <OngletCouts couts={couts} />
          </div>
        ) : (
          /* 7 blocs de résultats */
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">
            {BLOCS.map((blocConfig, i) => {
              const hasData = !!resultats?.[blocConfig.id]
              const coutBloc = calculerCoutBloc(couts, blocConfig.coutKey)

              return (
                <section
                  key={blocConfig.id}
                  id={`bloc-${blocConfig.id}`}
                  ref={(el) => {
                    if (el) sectionsRef.current[blocConfig.id] = el
                  }}
                  className="scroll-mt-4"
                >
                  {/* En-tête du bloc */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-border">
                    <span className="text-2xl">{blocConfig.icone}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted font-mono">Bloc {i + 1}</span>
                        <h2 className="font-bold text-brand-navy text-lg">{blocConfig.label}</h2>
                      </div>
                      {coutBloc > 0 && <CoutTooltip cout={coutBloc} />}
                    </div>
                    {hasData ? (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full border border-green-200 font-medium">
                        ✅ Terminé
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full border border-gray-200 font-medium">
                        ⏳ Non calculé
                      </span>
                    )}
                  </div>

                  {/* Contenu du bloc */}
                  {hasData ? (
                    BLOC_RENDERERS[blocConfig.id]?.(resultats)
                  ) : (
                    <div className="p-8 text-center bg-brand-bg/50 rounded-lg border border-brand-border border-dashed">
                      <p className="text-text-muted text-sm">
                        Ce bloc n&apos;a pas encore été calculé.
                      </p>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
