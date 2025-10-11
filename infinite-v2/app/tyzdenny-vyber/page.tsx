import { ArticlesAPI } from "@/lib/api"
import { generateSEO } from "@/components/seo"
import { ArticleCard } from "@/components/article-card"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { Star, TrendingUp } from "lucide-react"

export const metadata = generateSEO({
  title: "Týždenný výber",
  description: "Kurátorovaný výber najlepších vesmírnych objavov a článkov z tohto týždňa.",
})

// Disable static generation for this page to avoid build issues
export const dynamic = 'force-dynamic'

export default async function WeeklyPicksPage() {
  // Fetch real articles from the tyzdenny-vyber category
  let weeklyPicks: any[] = []
  let error: string | null = null
  
  try {
    const response = await ArticlesAPI.getArticlesByCategory("tyzdenny-vyber", 6)
    weeklyPicks = response.articles || []
  } catch (err) {
    console.error('Error fetching weekly picks:', err)
    error = 'Nepodarilo sa načítať týždenný výber'
  }

  const currentWeek = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col">
      {/* Breadcrumbs */}
      <div className="relative border-b border-border/50 bg-gradient-to-r from-card/40 via-card/20 to-card/40 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "Domov", href: "/" }, { label: "Týždenný výber" }]} />
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border bg-gradient-to-b from-card/50 to-transparent py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            <Star className="h-4 w-4" />
            <span>Týždenný výber</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-foreground lg:text-5xl">Týždenný výber</h1>
          <p className="mb-2 max-w-2xl text-lg text-muted-foreground">
            Najlepšie vesmírne objavy a články z tohto týždňa vybrané redakciou Infinite.
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Aktualizované: {currentWeek}</span>
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-16">
            <h2 className="mb-4 text-2xl font-bold text-foreground">Chyba pri načítavaní</h2>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground">Skúste obnoviť stránku alebo to skúste neskôr.</p>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!error && weeklyPicks.length === 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-16">
            <Star className="mb-4 h-16 w-16 text-muted-foreground/50" />
            <h2 className="mb-4 text-2xl font-bold text-foreground">Žiadne články v týždennom výbere</h2>
            <p className="mb-4 text-center text-muted-foreground">
              Momentálne nie sú dostupné žiadne články v kategórii týždenný výber.
            </p>
            <p className="text-sm text-muted-foreground">
              Nové články sa pridávajú každý týždeň v utorok ráno.
            </p>
          </div>
        </section>
      )}

      {/* Featured Pick */}
      {!error && weeklyPicks.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent">Objav týždňa</h2>
            <p className="text-muted-foreground">Najvýznamnejší objav, ktorý tento týždeň ohromil svet astronómie</p>
          </div>
          <div className="mb-12 overflow-hidden rounded-3xl border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-1">
            <ArticleCard {...weeklyPicks[0]} />
          </div>

          {/* Other Picks */}
          {weeklyPicks.length > 1 && (
            <>
              <div className="mb-8">
                <h2 className="mb-2 text-2xl font-bold text-foreground">Ďalšie výbery týždňa</h2>
                <p className="text-muted-foreground">Články a objavy, ktoré stoja za prečítanie</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {weeklyPicks.slice(1).map((article) => (
                  <ArticleCard key={article.slug} {...article} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Newsletter CTA */}
      <section className="border-t border-border bg-card/50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <NewsletterSignup />
        </div>
      </section>
    </div>
  )
}
