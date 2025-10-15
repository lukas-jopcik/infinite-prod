import { notFound, redirect } from "next/navigation"
import Image from "next/image"
import { ArticlesAPI, Article, ArticleDetail } from "@/lib/api"
import { generateArticleMetadata, getArticleMetaDescription, generateArticleStructuredData, generateBreadcrumbStructuredData, generateFAQStructuredData, generateImageObjectStructuredData } from "@/lib/seo"
import { CategoryBadge } from "@/components/category-badge"
import { ArticleCard } from "@/components/article-card"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { ScrollToTop } from "@/components/scroll-to-top"
import { ArticlePageWrapper, SocialSharingSection } from "@/components/article-page-wrapper"
import { AdContainer } from "@/components/ad-manager"
import { ImageLicenseInfo } from "@/components/image-license-info"
import { Calendar, ExternalLink } from "lucide-react"
import { ArticleStructuredData, BreadcrumbStructuredData, FAQStructuredData, ImageObjectStructuredData } from "@/components/structured-data"
import { generateArticleAltText } from "@/lib/alt-text-generator"
import SpaceArticleTemplate, { SpaceArticleData } from "@/components/space-article-template"
import { buildBulvarMeta } from "@/lib/seo-bulvar"
import type { Metadata } from "next"

interface NewsArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: NewsArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      return {
        title: "Článok nenájdený | Infinite",
        description: "Požadovaný článok nebol nájdený.",
      }
    }

    // Use bulvár SEO for news articles
    if (article.category === "news" && article.type === "news") {
            const bulvarMeta = buildBulvarMeta({
              headline: article.title,
              perex: article.perex,
              body: article.content ? (Array.isArray(article.content) ? article.content.map(section => section.content) : [article.content]) : []
            });
      

      return {
        title: bulvarMeta.metaTitle,
        description: bulvarMeta.metaDescription,
        keywords: bulvarMeta.keywords,
        openGraph: {
          title: article.title,
          description: article.perex,
          images: (article.heroImage?.src || article.imageUrl) ? [{ url: article.heroImage?.src || article.imageUrl! }] : undefined,
          type: 'article',
          publishedTime: article.publishedAt,
          authors: article.author ? [article.author] : undefined,
          section: article.category,
        },
        twitter: {
          card: 'summary_large_image',
          title: article.title,
          description: article.perex,
          images: (article.heroImage?.src || article.imageUrl) ? [{ url: article.heroImage?.src || article.imageUrl! }] : undefined,
        },
        alternates: {
          canonical: `https://infinite.sk/vesmirne-novinky/${article.slug}`,
        },
      };
    } else {
      return generateArticleMetadata({
        title: article.title,
        description: getArticleMetaDescription(article, article.category),
        slug: article.slug,
        imageUrl: article.imageUrl,
        publishedAt: article.publishedAt,
        originalDate: article.originalDate,
        author: article.author,
        category: article.category,
        tags: article.tags,
      });
    }
  } catch {
    return {
      title: "Článok nenájdený | Infinite",
      description: "Požadovaný článok nebol nájdený.",
    }
  }
}

// Generate static params for all news articles
export async function generateStaticParams() {
  try {
    const response = await ArticlesAPI.getArticlesByCategory("news", 100)
    return response.articles.map((article) => ({
      slug: article.slug,
    }))
  } catch (error) {
    console.error('Error generating static params for news articles:', error)
    return []
  }
}

// Add revalidation
export const revalidate = 3600 // Revalidate every hour (ISR)
export const dynamicParams = true // Allow dynamic params for new articles

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = await params
  
  let article: ArticleDetail | null = null
  let relatedArticles: Article[] = []
  
  try {
    // Get the article by slug using optimized endpoint
    article = await ArticlesAPI.getArticleBySlug(slug)
    
    if (article) {
      // Get related articles using optimized category endpoint
      const response = await ArticlesAPI.getArticlesByCategory(article.category, 10)
      relatedArticles = response.articles
        .filter(a => a.slug !== slug)
        .slice(0, 3)
    }
  } catch (error) {
    console.error('Error fetching article:', error)
    // If API fails, show 404 instead of mock data
    notFound()
  }

  if (!article) {
    notFound()
  }

  // Redirect to correct URL based on category
  if (article.category === "objav-dna") {
    redirect(`/objav-dna/${slug}`)
  } else if (article.category === "tyzdenny-vyber") {
    redirect(`/tyzdenny-vyber/${slug}`)
  } else if (article.category !== "news") {
    redirect(`/clanok/${slug}`)
  }

  return (
    <ArticlePageWrapper article={article}>
      {/* Structured Data in Head */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateArticleStructuredData({
            title: article.title,
            description: article.perex,
            slug: article.slug,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
            originalDate: article.originalDate,
            author: article.author,
            category: article.category,
            tags: article.tags,
          }), null, 2),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateBreadcrumbStructuredData([
            { name: "Domov", url: "/" },
            { name: "Vesmírne novinky", url: "/kategoria/vesmirne-novinky" },
            { name: article.title, url: `/vesmirne-novinky/${article.slug}` },
          ]), null, 2),
        }}
      />
      {article.faq && article.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateFAQStructuredData(article.faq), null, 2),
          }}
        />
      )}
      {article.imageUrl && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateImageObjectStructuredData({
              url: article.imageUrl,
              alt: article.title,
              caption: article.title,
              creator: article.imagePhotographer || (article.source === 'apod-rss' ? 'NASA APOD' : article.source === 'esa-hubble' ? 'ESA Hubble' : article.source),
              license: article.imageLicense,
            }), null, 2),
          }}
        />
      )}
      <div className="flex flex-col">
        <ScrollToTop />

        {/* Breadcrumbs */}
        <div className="relative border-b border-border/50 bg-gradient-to-r from-card/40 via-card/20 to-card/40 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5" />
          <div className="relative mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { label: "Domov", href: "/" },
                { label: "Vesmírne novinky", href: "/kategoria/vesmirne-novinky" },
                { label: article.title },
              ]}
            />
          </div>
        </div>

        {/* Render Space.com template for news articles */}
        {article.category === "news" && article.type === "news" ? (
          <SpaceArticleTemplate 
            data={{
              headline: article.title,
              perex: article.perex,
              body: article.content ? (Array.isArray(article.content) ? article.content.map(section => typeof section === 'string' ? section : (section as any).content || (section as any).S || '') : [article.content]) : [],
              subheads: article.subheads ? (Array.isArray(article.subheads) ? article.subheads.map(subhead => typeof subhead === 'string' ? subhead : (subhead as any).S || '') : []) : [],
              hero: {
                src: article.heroImage?.src || article.imageUrl || "/placeholder.svg",
                alt: article.heroImage?.alt || article.title,
                credit: article.heroImage?.credit
              },
              inline: article.inlineImage ? {
                src: (article.inlineImage.src as any)?.S || article.inlineImage.src,
                alt: (article.inlineImage.alt as any)?.S || article.inlineImage.alt,
                credit: (article.inlineImage.credit as any)?.S || article.inlineImage.credit
              } : undefined,
              inline2: article.inlineImage2 ? {
                src: (article.inlineImage2.src as any)?.S || article.inlineImage2.src,
                alt: (article.inlineImage2.alt as any)?.S || article.inlineImage2.alt,
                credit: (article.inlineImage2.credit as any)?.S || article.inlineImage2.credit
              } : undefined,
              author: article.author,
              publishedAt: article.publishedAt,
              category: article.category,
              originalUrl: article.sourceUrl,
              cta: article.cta
            }}
          />
        ) : (
          <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <p className="text-center text-muted-foreground">
              Tento článok nie je dostupný v tejto sekcii.
            </p>
          </div>
        )}

        {/* Newsletter Signup */}
        <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-accent/5 to-accent/10 p-8 text-center">
          <h3 className="mb-2 text-2xl font-bold text-foreground">Nenechaj si ujsť žiadne vesmírne novinky</h3>
          <p className="mb-6 text-muted-foreground">Dostávaj najnovšie správy z vesmíru priamo do svojej schránky.</p>
          <NewsletterSignup />
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="border-t border-border bg-card/30 py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="mb-8 text-3xl font-bold text-foreground">Súvisiace články</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard 
                    key={relatedArticle.slug} 
                    slug={relatedArticle.slug}
                    title={relatedArticle.title}
                    perex={relatedArticle.perex}
                    category={relatedArticle.category}
                    date={relatedArticle.originalDate || relatedArticle.publishedAt}
                    image={relatedArticle.imageUrl || "/placeholder.svg"}
                    imageAlt={relatedArticle.title}
                    type={(relatedArticle.type as "article" | "discovery") || "article"}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </ArticlePageWrapper>
  )
}
