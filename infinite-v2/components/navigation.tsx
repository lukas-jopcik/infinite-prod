"use client"

import Link from "next/link"
import { Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { cn } from "@/lib/utils"

const categories = [
  { name: "Objav dňa", slug: "objav-dna" },
  { name: "Komunita", slug: "komunita" },
  { name: "Týždenný výber", slug: "tyzdenny-vyber" },
]

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" prefetch={true} scroll={true} shallow={false}>
            <div className="text-2xl font-bold tracking-tight text-foreground">Infinite</div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-6 md:flex">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/kategoria/${category.slug}`}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                prefetch={true}
                scroll={true}
                shallow={false}
              >
                {category.name}
              </Link>
            ))}
          </div>

          {/* Search & Mobile Menu */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/hladat" prefetch={true} scroll={true} shallow={false}>
                <Search className="h-5 w-5" />
                <span className="sr-only">Hľadať</span>
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 md:hidden",
            mobileMenuOpen ? "max-h-96 pb-4" : "max-h-0",
          )}
        >
          <div className="flex flex-col gap-2 pt-2">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/kategoria/${category.slug}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                onClick={() => setMobileMenuOpen(false)}
                prefetch={true}
                scroll={true}
                shallow={false}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
