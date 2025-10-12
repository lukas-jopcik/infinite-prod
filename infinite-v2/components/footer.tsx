import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const categories = [
  { name: "Objav dňa", slug: "objav-dna" },
  { name: "Komunita", slug: "komunita" },
  { name: "Týždenný výber", slug: "tyzdenny-vyber" },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div className="lg:col-span-2">
            <h3 className="mb-4 text-lg font-bold text-foreground">Infinite</h3>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Denné objavy z vesmíru, vizuálne snímky a vzdelávacie články o astronómii. Objavuj s nami nekonečné
              tajomstvá vesmíru každý deň.
            </p>
            <div className="flex gap-2">
              <Input type="email" placeholder="Tvoj email" className="max-w-xs" />
              <Button>Odoberať</Button>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Kategórie</h4>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/kategoria/${category.slug}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    prefetch={true}
                    scroll={true}
                    shallow={false}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Informácie</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/o-projekte"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                  prefetch={true}
                  scroll={true}
                  shallow={false}
                >
                  O projekte
                </Link>
              </li>
              <li>
                <Link href="/hladat" className="text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer" prefetch={true} scroll={true} shallow={false}>
                  Vyhľadávanie
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          © 2025 Infinite – Objav dňa
        </div>
      </div>
    </footer>
  )
}
