import { generateSEO } from "@/components/seo"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { Rocket, Eye, Heart, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = generateSEO({
  title: "O projekte Infinite",
  description: "Spoznajte Infinite – váš denný sprievodca vesmírnymi objavmi a astronómiou.",
})

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Breadcrumbs */}
      <div className="relative border-b border-border/50 bg-gradient-to-r from-card/40 via-card/20 to-card/40 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="relative mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "Domov", href: "/" }, { label: "O projekte" }]} />
        </div>
      </div>

      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-b from-card/50 to-transparent py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center justify-center rounded-full bg-accent/10 p-4">
            <Rocket className="h-10 w-10 text-accent" />
          </div>
          <h1 className="mb-6 text-4xl font-bold text-foreground lg:text-5xl">O projekte Infinite</h1>
          <p className="text-pretty text-xl leading-relaxed text-muted-foreground">
            Infinite je moderný magazínový portál venovaný vesmírnym objavom, astronómii a vizuálnym snímkom z vesmíru.
            Každý deň prinášame nové objavy, vzdelávacie články a fascinujúce pohľady na nekonečný vesmír.
          </p>
        </div>
      </div>

      {/* Content */}
      <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg prose-invert max-w-none">
          {/* Mission */}
          <section className="mb-12">
            <h2 className="mb-6 text-3xl font-bold text-foreground">Naša misia</h2>
            <p className="leading-relaxed text-muted-foreground">
              Veríme, že vesmír je najväčším zdrojom inšpirácie a úžasu. Naším cieľom je sprístupniť vesmírne objavy
              širokej verejnosti a vzbudiť záujem o astronómiu u ľudí všetkých vekových kategórií.
            </p>
          </section>

          {/* Values */}
          <section className="mb-12">
            <h2 className="mb-8 text-3xl font-bold text-foreground">Naše hodnoty</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-accent/10 p-3">
                  <Eye className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Objavovanie</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Každý deň prinášame nové objavy a pohľady na vesmír, ktoré inšpirujú a vzdelávajú.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-accent/10 p-3">
                  <Heart className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Vášeň</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Sme nadšení pre astronómiu a túto vášeň chceme zdieľať s našimi čitateľmi.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-accent/10 p-3">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Komunita</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Budujeme komunitu ľudí, ktorí sa zaujímajú o vesmír a chcú sa o ňom dozvedieť viac.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-accent/10 p-3">
                  <Rocket className="h-6 w-6 text-accent" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">Inovácia</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Využívame moderné technológie na sprístupnenie vesmírnych objavov širokej verejnosti.
                </p>
              </div>
            </div>
          </section>

          {/* What We Offer */}
          <section className="mb-12">
            <h2 className="mb-6 text-3xl font-bold text-foreground">Čo ponúkame</h2>
            <div className="space-y-4">
              <div className="rounded-lg border-l-4 border-accent bg-card/50 p-4">
                <h3 className="mb-1 font-semibold text-foreground">Objav dňa</h3>
                <p className="text-sm text-muted-foreground">
                  Každý deň nový vizuálny snímok z vesmíru s podrobným vysvetlením a kontextom.
                </p>
              </div>
              <div className="rounded-lg border-l-4 border-accent bg-card/50 p-4">
                <h3 className="mb-1 font-semibold text-foreground">Vzdelávacie články</h3>
                <p className="text-sm text-muted-foreground">
                  Podrobné vysvetlenia vesmírnych javov, astronómie a najnovších vedeckých objavov.
                </p>
              </div>
              <div className="rounded-lg border-l-4 border-accent bg-card/50 p-4">
                <h3 className="mb-1 font-semibold text-foreground">Komunitný obsah</h3>
                <p className="text-sm text-muted-foreground">
                  Príspevky z astronomickej komunity, astrofotografie a diskusie o vesmíre.
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="mb-6 text-3xl font-bold text-foreground">Kontakt</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Máte otázky, návrhy alebo chcete spolupracovať? Radi sa s vami spojíme.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/hladat">Prehľadávať články</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Späť na domov</Link>
              </Button>
            </div>
          </section>
        </div>
      </article>

      {/* Newsletter CTA */}
      <section className="border-t border-border bg-card/50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <NewsletterSignup />
        </div>
      </section>
    </div>
  )
}
