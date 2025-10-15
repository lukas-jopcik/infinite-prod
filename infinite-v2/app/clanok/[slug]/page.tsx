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

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      return {
        title: "Článok nenájdený | Infinite",
        description: "Požadovaný článok nebol nájdený.",
      }
    }

    // Use bulvár SEO for news articles, regular SEO for others
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
          canonical: `https://infinite.sk/clanok/${article.slug}`,
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

// Generate static params for all articles
export async function generateStaticParams() {
  try {
    // Fetch articles from multiple categories
    const categories = ["objav-dna", "news", "tyzdenny-vyber"]
    const allArticles: Article[] = []
    
    for (const category of categories) {
      try {
        const response = await ArticlesAPI.getArticlesByCategory(category, 100)
        allArticles.push(...response.articles)
      } catch (error) {
        console.error(`Error fetching ${category} articles:`, error)
      }
    }
    
    return allArticles.map((article) => ({
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

export default async function ArticlePage({ params }: ArticlePageProps) {
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
  } else if (article.category === "news") {
    redirect(`/vesmirne-novinky/${slug}`)
  }
  // Other articles stay on /clanok/ URL

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
            { name: article.category === "tyzdenny-vyber" ? "Týždenný výber" : article.category === "news" ? "Vesmírne novinky" : article.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), url: article.category === "news" ? "/kategoria/vesmirne-novinky" : `/kategoria/${article.category}` },
            { name: article.title, url: `/clanok/${article.slug}` },
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
                {
                  label:
                    article.category === "tyzdenny-vyber"
                      ? "Týždenný výber"
                      : article.category === "news"
                      ? "Vesmírne novinky"
                      : article.category
                          .split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" "),
                  href: article.category === "news" ? "/kategoria/vesmirne-novinky" : `/kategoria/${article.category}`,
                },
                { label: article.title },
              ]}
            />
          </div>
        </div>

        {/* Conditional rendering for news articles */}
        {article.category === "news" && article.type === "news" ? (
          <SpaceArticleTemplate 
            data={{
              headline: article.title,
              perex: article.perex,
              body: article.content ? (Array.isArray(article.content) ? article.content.map(section => section.content) : [article.content]) : [],
              subheads: article.subheads || [],
              hero: {
                src: article.heroImage?.src || article.imageUrl || "/placeholder.svg",
                alt: article.heroImage?.alt || article.title,
                credit: article.heroImage?.credit
              },
                      inline: article.inlineImage ? {
                        src: article.inlineImage.src,
                        alt: article.inlineImage.alt,
                        credit: article.inlineImage.credit
                      } : undefined,
                      inline2: article.inlineImage2 ? {
                        src: article.inlineImage2.src,
                        alt: article.inlineImage2.alt,
                        credit: article.inlineImage2.credit
                      } : undefined,
              author: article.author,
              publishedAt: article.publishedAt,
              category: article.category,
              originalUrl: article.sourceUrl,
              cta: article.cta
            }}
          />
        ) : (
          <>
            {/* Article Header */}
            <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
              <header className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <CategoryBadge category={article.category} />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <time dateTime={article.originalDate || article.publishedAt}>
                  {new Date(article.originalDate || article.publishedAt).toLocaleDateString("sk-SK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC"
                  })}
                </time>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-100/10 px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200/20">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                AI generované
              </div>
            </div>

            <h1 className="mb-4 text-balance text-4xl font-bold leading-tight text-foreground lg:text-5xl">
              {article.title}
            </h1>

            <p className="text-pretty text-xl leading-relaxed text-muted-foreground">{article.perex}</p>
          </header>

          {/* Hero Image - Only show for non-news articles */}
          {article.category !== 'news' && (
            <div className="mb-8">
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
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
              
              {/* Image Source and Illustrative Notice */}
              <div className="mt-3 flex items-center justify-between">
                {/* Left side - Illustrative photo notice with dynamic Pexels source */}
                <div className="text-xs text-muted-foreground">
                  Fotografia je ilustračná | Zdroj: {article.imageCreditText || 'Photo by Pexels Contributor on Pexels'}
                </div>
                
                {/* Right side - Official source */}
                {article.source && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ExternalLink className="h-4 w-4" />
                    <span>Oficiálny zdroj: </span>
                    {article.sourceUrl ? (
                      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 underline">
                        {article.source === 'apod-rss' ? 'NASA APOD' : article.source === 'esa-hubble' ? 'ESA Hubble' : article.source}
                      </a>
                    ) : (
                      <span>{article.source === 'apod-rss' ? 'NASA APOD' : article.source === 'esa-hubble' ? 'ESA Hubble' : article.source}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Article Ad */}
          <AdContainer position="article" />

          {/* Article Content */}
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
            {/* Image Source - Only for non-news articles */}
            {article.source && article.category !== 'news' && (
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
            
            {/* Source for news articles */}
            {article.category === 'news' && article.sourceUrl && (
              <div className="rounded-lg border border-border bg-card/50 p-6">
                <div className="flex items-start gap-3">
                  <ExternalLink className="mt-1 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="mb-1 text-sm font-medium text-foreground">Zdroj</p>
                    <p className="text-sm text-muted-foreground">
                      Fotografiu a ďalšie informácie nájdete na:{" "}
                      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 underline">
                        Reddit
                      </a>
                    </p>
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
            url={`https://infinite.sk/clanok/${article.slug}`}
          />

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center">
            <h3 className="mb-2 text-2xl font-bold text-foreground">Chceš viac objavov ako tento?</h3>
            <p className="mb-6 text-muted-foreground">Prihlás sa na odber Objavu dňa.</p>
            <NewsletterSignup />
          </div>
          
          {/* Image License Information - moved to end of article */}
          <ImageLicenseInfo article={article} />
        </article>
          </>
        )}

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
                    author={relatedArticle.author}
                    source="Infinite AI"
                    type="article"
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
