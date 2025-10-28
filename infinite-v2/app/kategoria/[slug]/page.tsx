import { notFound } from "next/navigation"
import { ArticlesAPI, Article } from "@/lib/api"
import { generateCategoryMetadata } from "@/lib/seo"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CategoryBadge } from "@/components/category-badge"
import { CategoryArticlesSimple as CategoryArticles } from "@/components/category-articles-simple"
import type { Metadata } from "next"

const categories = [
  { name: "Objav dňa", slug: "objav-dna", description: "Denné objavy a vizuálne snímky z vesmíru" },
  { name: "Vesmírne novinky", slug: "vesmirne-novinky", description: "Najnovšie správy a udalosti z vesmíru a astronómie 🚀" },
  { name: "Týždenný výber", slug: "tyzdenny-vyber", description: "Kurátorovaný výber najlepších objavov týždňa" },
  { name: "Vesmírne objavy", slug: "vesmirne-objavy", description: "Fascinujúce vesmírne objavy vysvetlené jednoducho 🤖" },
]

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const category = categories.find((c) => c.slug === slug)

  if (!category) {
    return {
      title: "Kategória nenájdená | Infinite",
      description: "Požadovaná kategória nebola nájdená.",
    }
  }

  return generateCategoryMetadata(slug, category.description)
}

// Generate static params for all categories
export async function generateStaticParams() {
  return categories.map((category) => ({
    slug: category.slug,
  }))
}

// Add revalidation
export const revalidate = 3600 // Revalidate every hour (ISR)

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const category = categories.find((c) => c.slug === slug)

  if (!category) {
    notFound()
  }

  // Map slug to database category name
  const dbCategory = slug === 'vesmirne-novinky' ? 'news' : slug === 'vesmirne-objavy' ? 'ai-discoveries' : slug

  // Fetch initial articles from API using optimized category endpoint
  let initialArticles: Article[] = []
  let initialLastKey: string | undefined
  let totalCount = 0
  
  try {
    const response = await ArticlesAPI.getArticlesByCategory(dbCategory, 100) // Fetch more for pagination
    if (response && response.articles) {
      initialArticles = response.articles.slice(0, 12) // Show first 12 articles (4 rows)
      initialLastKey = response.lastKey
      totalCount = response.count || 0
    }
  } catch (error) {
    console.error('Error fetching articles:', error)
    // Fallback to empty array if API fails
    initialArticles = []
    totalCount = 0
  }

  return (
    <div className="flex flex-col">
      {/* Breadcrumbs */}
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "Domov", href: "/" }, { label: category.name }]} />
        </div>
      </div>

      {/* Category Header */}
      <div className="border-b border-border bg-gradient-to-b from-card/50 to-transparent py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <CategoryBadge category={slug} className="text-base" />
          </div>
          <h1 className="mb-4 text-4xl font-bold text-foreground lg:text-5xl">{category.name}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{category.description}</p>
        </div>
      </div>

      {/* Articles Grid with Pagination */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {initialArticles && initialArticles.length > 0 ? (
          <CategoryArticles
            category={dbCategory}
            initialArticles={initialArticles}
            initialLastKey={initialLastKey}
            initialCount={totalCount}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="text-lg text-muted-foreground">V tejto kategórii zatiaľ nie sú žiadne články.</p>
          </div>
        )}
      </section>
    </div>
  )
}
