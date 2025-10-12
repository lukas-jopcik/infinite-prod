import { notFound, redirect } from "next/navigation"
import Image from "next/image"
import { ArticlesAPI, Article, ArticleDetail } from "@/lib/api"
import { generateArticleMetadata } from "@/lib/seo"
import { CategoryBadge } from "@/components/category-badge"
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

interface WeeklyPickPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: WeeklyPickPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      return {
        title: "Týždenný výber nenájdený | Infinite",
        description: "Požadovaný článok z týždenného výberu nebol nájdený.",
      }
    }

    return generateArticleMetadata({
      title: article.title,
      description: article.metaDescription || article.perex,
      slug: article.slug,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      originalDate: article.originalDate,
      author: article.author,
      category: article.category,
      tags: article.tags,
    })
  } catch {
    return {
      title: "Týždenný výber nenájdený | Infinite",
      description: "Požadovaný článok z týždenného výberu nebol nájdený.",
    }
  }
}

export default async function WeeklyPickPage({ params }: WeeklyPickPageProps) {
  const { slug } = await params
  
  let article: ArticleDetail | null = null
  let relatedArticles: Article[] = []
  
  try {
    // Get the article by slug using optimized endpoint
    article = await ArticlesAPI.getArticleBySlug(slug)
    
    if (article) {
      // Get related articles using optimized category endpoint
      const response = await ArticlesAPI.getArticlesByCategory("tyzdenny-vyber", 10)
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

  // If this is not a weekly pick, redirect to correct URL or show 404
  if (article.category === "objav-dna") {
    redirect(`/objav-dna/${slug}`)
  } else if (article.category !== "tyzdenny-vyber") {
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
            { name: "Týždenný výber", url: "/kategoria/tyzdenny-vyber" },
            { name: article.title, url: `/tyzdenny-vyber/${article.slug}` },
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
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5" />
          <div className="relative mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { label: "Domov", href: "/" },
                { label: "Týždenný výber", href: "/kategoria/tyzdenny-vyber" },
                { label: article.title },
              ]}
            />
          </div>
        </div>

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
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-100/10 px-3 py-1 text-xs font-medium text-purple-500 border border-purple-200/20">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clipRule="evenodd" />
                </svg>
                Týždenný výber
              </div>
            </div>

            <h1 className="mb-4 text-balance text-4xl font-bold leading-tight text-foreground lg:text-5xl">
              {article.title}
            </h1>

            <p className="text-pretty text-xl leading-relaxed text-muted-foreground">{article.perex}</p>
          </header>

          {/* Hero Image */}
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
                  <path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clipRule="evenodd" />
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
            url={`https://infinite.sk/tyzdenny-vyber/${article.slug}`}
          />

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-purple-500/5 to-blue-500/5 p-8 text-center">
            <h3 className="mb-2 text-2xl font-bold text-foreground">Chceš viac týždenných výberov?</h3>
            <p className="mb-6 text-muted-foreground">Prihlás sa na odber a dostávaj najlepšie články každý týždeň.</p>
            <NewsletterSignup />
          </div>

          {/* Image License Information - moved to end of article */}
          <ImageLicenseInfo article={article} />
        </article>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="border-t border-border bg-card/30 py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="mb-8 text-3xl font-bold text-foreground">Ďalšie týždenné výbery</h2>
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
