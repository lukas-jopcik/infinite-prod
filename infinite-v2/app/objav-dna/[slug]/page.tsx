import { notFound, redirect } from "next/navigation"
import Image from "next/image"
import { ArticlesAPI, Article, ArticleDetail } from "@/lib/api"
import { generateArticleMetadata, getArticleMetaDescription } from "@/lib/seo"
import { ArticleCard } from "@/components/article-card"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { ScrollToTop } from "@/components/scroll-to-top"
import { ArticleStructuredData, BreadcrumbStructuredData, FAQStructuredData, ImageObjectStructuredData } from "@/components/structured-data"
import { ArticlePageWrapper, SocialSharingSection } from "@/components/article-page-wrapper"
import { generateArticleAltText } from "@/lib/alt-text-generator"
import { AdContainer } from "@/components/ad-manager"
import { ImageLicenseInfo } from "@/components/image-license-info"
import { Calendar, ExternalLink } from "lucide-react"
import type { Metadata } from "next"

interface DiscoveryPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: DiscoveryPageProps): Promise<Metadata> {
  const { slug } = await params
  
  // Use the optimized getArticleBySlug endpoint for metadata
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      return {
        title: "Objav nenájdený | Infinite",
        description: "Požadovaný objav nebol nájdený.",
      }
    }

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
    })
  } catch (error) {
    return {
      title: "Objav nenájdený | Infinite",
      description: "Požadovaný objav nebol nájdený.",
    }
  }
}

// Generate static params for all articles
export async function generateStaticParams() {
  try {
    // Fetch all articles from API
    const response = await ArticlesAPI.getArticlesByCategory("objav-dna", 100)
    
    return response.articles.map((article) => ({
      slug: article.slug,
    }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

// Add revalidation
export const revalidate = 3600 // Revalidate every hour (ISR)
export const dynamicParams = true // Allow dynamic params for new articles

export default async function DiscoveryPage({ params }: DiscoveryPageProps) {
  const { slug } = await params
  
  let article: ArticleDetail | null = null
  let relatedDiscoveries: Article[] = []
  
  try {
    // Get the article by slug using optimized endpoint
    article = await ArticlesAPI.getArticleBySlug(slug)
    
    if (!article) {
      notFound()
    }

    // If this is not an objav-dna article, redirect to correct URL or show 404
    if (article.category === "tyzdenny-vyber") {
      redirect(`/tyzdenny-vyber/${slug}`)
    } else if (article.category !== "objav-dna") {
      notFound()
    }
    
    // Get related discoveries using optimized category endpoint
    const response = await ArticlesAPI.getArticlesByCategory("objav-dna", 10)
    relatedDiscoveries = response.articles
      .filter(a => a.slug !== slug)
      .slice(0, 3)
  } catch (error) {
    console.error('Error fetching article:', error)
    // If API fails, show 404 instead of mock data
    notFound()
  }

  return (
    <ArticlePageWrapper article={article}>
      <div className="flex flex-col">
        <ScrollToTop />
        
        {/* Structured Data */}
        <ArticleStructuredData 
          article={{
            title: article.title,
            description: article.perex,
            slug: article.slug,
            imageUrl: article.imageUrl,
            publishedAt: article.publishedAt,
            originalDate: article.originalDate,
            author: article.author,
            category: article.category,
            tags: article.tags,
          }}
        />
        <BreadcrumbStructuredData 
          items={[
            { name: "Domov", url: "/" },
            { name: "Objav dňa", url: "/kategoria/objav-dna" },
            { name: article.title, url: `/objav-dna/${article.slug}` },
          ]}
        />
        {article.faq && article.faq.length > 0 && (
          <FAQStructuredData faqs={article.faq} />
        )}
        {article.imageUrl && (
          <ImageObjectStructuredData 
            image={{
              url: article.imageUrl,
              alt: article.title,
              caption: article.title,
              creator: article.imagePhotographer || (article.source === 'apod-rss' ? 'NASA APOD' : article.source === 'esa-hubble' ? 'ESA Hubble' : article.source),
              license: article.imageLicense,
            }}
          />
        )}

      {/* Breadcrumbs */}
      <div className="relative border-b border-border/50 bg-gradient-to-r from-card/40 via-card/20 to-card/40 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="relative mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Domov", href: "/" },
              { label: "Objav dňa", href: "/kategoria/objav-dna" },
              { label: article.title },
            ]}
          />
        </div>
      </div>

      {/* Discovery Content */}
      <article className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Date and AI Badges */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
            <Calendar className="h-4 w-4" />
            <time dateTime={article.originalDate || article.publishedAt}>
              Objav dňa –{" "}
              {new Date(article.originalDate || article.publishedAt).toLocaleDateString("sk-SK", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC"
              })}
            </time>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100/10 px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200/20">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            AI generované
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-6 text-balance text-4xl font-bold leading-tight text-foreground lg:text-5xl">
          {article.title}
        </h1>

        {/* Main Image - Larger for discoveries */}
        <div className="mb-8">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
            <Image
              src={article.imageUrl || "/placeholder.svg"}
              alt={generateArticleAltText({
                title: article.title,
                category: article.category,
                source: article.source,
              })}
              fill
              priority
              className="object-cover"
            />
          </div>
          {/* Image Source */}
          {article.source && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              <span>Zdroj: </span>
              {article.sourceUrl ? (
                <a 
                  href={article.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent/80 underline"
                >
                  {article.source === 'apod-rss' ? 'NASA APOD' : article.source === 'esa-hubble' ? 'ESA Hubble' : article.source}
                </a>
              ) : (
                <span>{article.source === 'apod-rss' ? 'NASA APOD' : article.source === 'esa-hubble' ? 'ESA Hubble' : article.source}</span>
              )}
            </div>
          )}

        </div>

        {/* Description */}
        <div className="prose prose-lg prose-invert max-w-none">
          <p className="text-pretty text-xl leading-relaxed text-muted-foreground">{article.perex}</p>
        </div>

        {/* Article Ad */}
        <AdContainer position="article" />

        {/* Article Sections */}
        {article.content && article.content.length > 0 && (
          <div className="mt-8 space-y-8">
            {article.content.map((section, index) => (
              <section key={index} className="prose prose-lg prose-invert max-w-none">
                <h2 className="text-2xl font-bold text-foreground mb-4">{section.title}</h2>
                <div className="text-foreground leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* FAQ Section */}
        {article.faq && article.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Často kladené otázky</h2>
            <div className="space-y-4">
              {article.faq.map((faq, index) => (
                <div key={index} className="border border-border rounded-lg p-6 bg-card/50">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Source and Credits */}
        <div className="mt-8 space-y-4">
          {/* Image Source */}
          {article.source && (
            <div className="rounded-lg border border-border bg-card/50 p-6">
              <div className="flex items-start gap-3">
                <ExternalLink className="mt-1 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="mb-1 text-sm font-medium text-foreground">Zdroj snímky</p>
                  <p className="text-sm text-muted-foreground">{article.source}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Content Credits */}
          <div className="rounded-lg border border-border bg-card/50 p-6">
            <div className="flex items-start gap-3">
              <svg className="mt-1 h-5 w-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="mb-1 text-sm font-medium text-foreground">Obsah článku</p>
                <p className="text-sm text-muted-foreground">
                  Článok bol vygenerovaný pomocou AI (OpenAI GPT-4) na základe oficiálnych zdrojov ako NASA APOD a ESA Hubble. 
                  Text bol preložený a prispôsobený pre slovenských čitateľov.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Social Sharing */}
        <SocialSharingSection 
          articleSlug={article.slug}
          articleTitle={article.title}
          url={`https://infinite.sk/objav-dna/${article.slug}`}
        />

        {/* Newsletter CTA */}
        <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-accent/5 to-accent/10 p-8 text-center">
          <h3 className="mb-2 text-2xl font-bold text-foreground">Nenechaj si ujsť žiadny objav</h3>
          <p className="mb-6 text-muted-foreground">Dostávaj Objav dňa priamo do svojej schránky každé ráno.</p>
          <NewsletterSignup />
        </div>

        {/* Image License Information - moved to end of article */}
        <ImageLicenseInfo article={article} />
      </article>

      {/* Related Discoveries */}
      {relatedDiscoveries.length > 0 && (
        <section className="border-t border-border bg-card/30 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-3xl font-bold text-foreground">Ďalšie objavy</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedDiscoveries.map((discovery) => (
                <ArticleCard 
                  key={discovery.slug} 
                  slug={discovery.slug}
                  title={discovery.title}
                  perex={discovery.perex}
                  category={discovery.category}
                  date={discovery.originalDate || discovery.publishedAt}
                  image={discovery.imageUrl || "/placeholder.svg"}
                  imageAlt={discovery.title}
                  author={discovery.author}
                  source="Infinite AI"
                  type="discovery"
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
