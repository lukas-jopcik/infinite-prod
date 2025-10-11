"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Article, ArticlesAPI } from "@/lib/api"
import { ArticleCard } from "@/components/article-card"
import { CommunityArticleCard } from "@/components/community-article-card"
import { Pagination } from "@/components/pagination"
import { Skeleton } from "@/components/ui/skeleton"

interface CategoryArticlesSimpleProps {
  category: string
  initialArticles: Article[]
  initialLastKey?: string
  initialCount: number
}

const ARTICLES_PER_PAGE = 12 // 4 rows × 3 columns

export function CategoryArticlesSimple({ 
  category, 
  initialArticles, 
  initialLastKey,
  initialCount 
}: CategoryArticlesSimpleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPageFromUrl = Number(searchParams.get("strana") || "1")

  const [articles, setArticles] = useState<Article[]>(initialArticles || [])
  const [currentPage, setCurrentPage] = useState(initialPageFromUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(initialCount || 0)

  useEffect(() => {
    if (initialPageFromUrl > 1) {
      loadPage(initialPageFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add safety checks for props
  if (!category) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <p className="text-lg text-muted-foreground">Chyba: Kategória nie je definovaná.</p>
      </div>
    )
  }

  const totalPages = Math.ceil(totalCount / ARTICLES_PER_PAGE)

  const loadPage = async (page: number) => {
    if (loading || !category) return

    setLoading(true)
    setError(null)

    try {
      const skip = (page - 1) * ARTICLES_PER_PAGE
      const response = await ArticlesAPI.getArticlesByCategory(category, 100)

      if (response && response.articles) {
        const startIndex = skip
        const endIndex = skip + ARTICLES_PER_PAGE
        const pageArticles = response.articles.slice(startIndex, endIndex)

        setArticles(pageArticles)
        setCurrentPage(page)
        setTotalCount(response.count || 0)
      } else {
        setError('Nepodarilo sa načítať články')
      }
    } catch (err) {
      setError('Nepodarilo sa načítať články')
      console.error('Error loading page:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    if (page !== currentPage && !loading) {
      const url = `/kategoria/${category}?strana=${page}`
      router.push(url)
      loadPage(page)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <p className="text-lg text-destructive">{error}</p>
        <button 
          onClick={() => loadPage(currentPage)}
          className="mt-4 text-sm text-accent hover:underline"
        >
          Skúsiť znovu
        </button>
      </div>
    )
  }

  if (articles.length === 0 && !loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center">
        <p className="text-lg text-muted-foreground">Žiadne články na zobrazenie.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Articles Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          // Loading skeleton
          Array.from({ length: ARTICLES_PER_PAGE }).map((_, index) => (
            <div key={index} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="aspect-[16/9] w-full" />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))
        ) : (
          articles.map((article) => {
            // Use CommunityArticleCard for community articles
            if (article.category === 'komunita') {
              return (
                <CommunityArticleCard 
                  key={article.slug} 
                  article={article}
                />
              )
            }
            
            // Use regular ArticleCard for other categories
            return (
              <ArticleCard 
                key={article.slug} 
                slug={article.slug}
                title={article.title}
                perex={article.perex}
                category={article.category}
                date={article.originalDate || article.publishedAt}
                image={article.imageUrl || "/placeholder.svg"}
                imageAlt={article.title}
                type={article.type as "article" | "discovery"}
              />
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          baseUrl={`/kategoria/${category}`}
          hasNextPage={currentPage < totalPages}
          hasPreviousPage={currentPage > 1}
          onPageChange={handlePageChange}
        />
      )}

      {/* Results Info */}
      <div className="text-center text-sm text-muted-foreground">
        Zobrazené {articles.length} z {totalCount} článkov
        {totalPages > 1 && ` • Strana ${currentPage} z ${totalPages}`}
      </div>
    </div>
  )
}