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

interface AIArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: AIArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      return {
        title: "Článok nenájdený | Infinite",
        description: "Požadovaný článok nebol nájdený.",
      }
    }

    // Use bulvár SEO for AI articles
    if (article.category === "ai-discoveries" && article.type === "ai-generated") {
      const bulvarMeta = buildBulvarMeta({
        headline: article.title,
        perex: article.perex,
        body: article.content ? (Array.isArray(article.content) ? article.content.map(section => section.content) : [article.content]) : []
      });

      return {
        title: `${article.title} | Vesmírne objavy | Infinite`,
        description: bulvarMeta.metaDescription,
        keywords: bulvarMeta.keywords,
        openGraph: {
          title: article.title,
          description: bulvarMeta.metaDescription,
          url: `https://infinite.sk/vesmirne-objavy/${slug}`,
          siteName: "Infinite",
          images: [
            {
              url: article.imageUrl || "https://infinite.sk/og-default.jpg",
              width: 1200,
              height: 630,
              alt: article.imageAlt || article.title,
            },
          ],
          locale: "sk_SK",
          type: "article",
        },
        twitter: {
          card: "summary_large_image",
          title: article.title,
          description: bulvarMeta.metaDescription,
          images: [article.imageUrl || "https://infinite.sk/og-default.jpg"],
        },
        alternates: {
          canonical: `https://infinite.sk/vesmirne-objavy/${slug}`,
        },
      }
    }

    // Fallback to standard metadata
    return generateArticleMetadata({
      title: article.title,
      description: getArticleMetaDescription(article),
      imageUrl: article.imageUrl,
      originalDate: article.originalDate || article.publishedAt,
      publishedAt: article.publishedAt,
      author: article.author || "Infinite AI",
      category: article.category,
      tags: article.tags,
      slug: slug,
    })
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: "Článok nenájdený | Infinite",
      description: "Požadovaný článok nebol nájdený.",
    }
  }
}

// Generate static params for all AI articles
export async function generateStaticParams() {
  try {
    const response = await ArticlesAPI.getArticlesByCategory("ai-discoveries", 1000)
    if (response && response.articles) {
      return response.articles.map((article) => ({
        slug: article.slug,
      }))
    }
    return []
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

// Add revalidation
export const revalidate = 3600 // Revalidate every hour (ISR)

export default async function AIArticlePage({ params }: AIArticlePageProps) {
  const { slug } = await params
  
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      notFound()
    }

    // Redirect if this is not an AI article
    if (article.category !== "ai-discoveries") {
      redirect(`/vesmirne-objavy/${slug}`)
    }

    // Get related articles
    let relatedArticles: Article[] = []
    try {
      const relatedResponse = await ArticlesAPI.getArticlesByCategory("ai-discoveries", 6)
      if (relatedResponse && relatedResponse.articles) {
        relatedArticles = relatedResponse.articles
          .filter(a => a.slug !== slug)
          .slice(0, 4)
      }
    } catch (error) {
      console.error('Error fetching related articles:', error)
    }

    // Prepare structured data
    const articleStructuredData = generateArticleStructuredData({
      title: article.title,
      description: getArticleMetaDescription(article),
      imageUrl: article.imageUrl,
      originalDate: article.originalDate || article.publishedAt,
      publishedAt: article.publishedAt,
      author: article.author || "Infinite AI",
      category: article.category,
      tags: article.tags,
      slug: slug,
    })

    const breadcrumbStructuredData = generateBreadcrumbStructuredData([
      { name: "Domov", url: "https://infinite.sk/" },
      { name: "Vesmírne objavy", url: "https://infinite.sk/kategoria/vesmirne-objavy" },
      { name: article.title, url: `https://infinite.sk/vesmirne-objavy/${slug}` },
    ])

    // Generate FAQ structured data for AI articles
    const faqStructuredData = generateFAQStructuredData([
      {
        question: `Čo je ${article.title.toLowerCase()}?`,
        answer: getArticleMetaDescription(article)
      },
      {
        question: "Ako funguje AI generovanie článkov?",
        answer: "Naše AI články sú vytvorené pomocou pokročilých algoritmov, ktoré analyzujú vesmírne objavy a vytvárajú zaujímavé a vzdelávacie články v slovenčine."
      }
    ])

    // Generate image structured data
    const imageStructuredData = generateImageObjectStructuredData({
      url: article.imageUrl || "https://infinite.sk/og-default.jpg",
      alt: article.imageAlt || article.title,
      caption: article.imageAlt || article.title,
      creator: article.imageAuthor || "NASA/ESA",
      license: article.imageLicense || "Public Domain"
    })

    // Convert article content to SpaceArticleData format
    const spaceArticleData: SpaceArticleData = {
      title: article.title,
      perex: article.perex,
      content: Array.isArray(article.content) 
        ? article.content.map(section => ({
            type: 'text',
            content: section.content || section
          }))
        : [{ type: 'text', content: article.content || '' }],
      imageUrl: article.imageUrl,
      imageAlt: article.imageAlt || article.title,
      imageAuthor: article.imageAuthor || "NASA/ESA",
      imageLicense: article.imageLicense || "Public Domain",
      publishedAt: article.publishedAt,
      originalDate: article.originalDate || article.publishedAt,
      category: article.category,
      tags: article.tags || [],
      readingTime: article.readingTime || 5,
      author: article.author || "Infinite AI",
      type: article.type || "ai-generated"
    }

    return (
      <ArticlePageWrapper>
        {/* Structured Data */}
        <ArticleStructuredData data={articleStructuredData} />
        <BreadcrumbStructuredData data={breadcrumbStructuredData} />
        <FAQStructuredData data={faqStructuredData} />
        <ImageObjectStructuredData data={imageStructuredData} />

        {/* Breadcrumbs */}
        <div className="border-b border-border bg-card/30">
          <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
            <Breadcrumbs items={[
              { label: "Domov", href: "/" },
              { label: "Vesmírne objavy", href: "/kategoria/vesmirne-objavy" },
              { label: article.title }
            ]} />
          </div>
        </div>

        {/* Article Content */}
        <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Article Header */}
          <header className="mb-8">
            <div className="mb-4">
              <CategoryBadge category="vesmirne-objavy" className="text-base" />
            </div>
            
            <h1 className="mb-4 text-3xl font-bold text-foreground lg:text-4xl xl:text-5xl">
              {article.title}
            </h1>
            
            <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <time dateTime={article.originalDate || article.publishedAt}>
                  {new Date(article.originalDate || article.publishedAt).toLocaleDateString('sk-SK', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
              </div>
              <div className="flex items-center gap-2">
                <span>🤖</span>
                <span>AI generovaný článok</span>
              </div>
              {article.readingTime && (
                <div className="flex items-center gap-2">
                  <span>⏱️</span>
                  <span>{article.readingTime} min čítania</span>
                </div>
              )}
            </div>

            {/* Article Image */}
            {article.imageUrl && (
              <div className="mb-8">
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
                  <Image
                    src={article.imageUrl}
                    alt={article.imageAlt || article.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                  />
                </div>
                <ImageLicenseInfo 
                  author={article.imageAuthor || "NASA/ESA"}
                  license={article.imageLicense || "Public Domain"}
                  source={article.imageSource}
                />
              </div>
            )}

            {/* Article Excerpt */}
            {article.perex && (
              <div className="mb-8 rounded-2xl border border-border bg-card/50 p-6">
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {article.perex}
                </p>
              </div>
            )}
          </header>

          {/* Ad Container */}
          <AdContainer 
            adUnit="infinite-article-top"
            className="mb-8"
          />

          {/* Article Content */}
          <SpaceArticleTemplate data={spaceArticleData} />

          {/* Ad Container */}
          <AdContainer 
            adUnit="infinite-article-middle"
            className="my-8"
          />

          {/* Social Sharing */}
          <SocialSharingSection 
            title={article.title}
            url={`https://infinite.sk/vesmirne-objavy/${slug}`}
            className="my-8"
          />

          {/* Newsletter Signup */}
          <NewsletterSignup className="my-12" />
        </article>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="border-t border-border bg-card/30 py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="mb-8 text-2xl font-bold text-foreground">
                Ďalšie vesmírne objavy
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard
                    key={relatedArticle.slug}
                    slug={relatedArticle.slug}
                    title={relatedArticle.title}
                    perex={relatedArticle.perex}
                    category={relatedArticle.category}
                    date={relatedArticle.originalDate || relatedArticle.publishedAt}
                    image={relatedArticle.imageUrl}
                    imageAlt={relatedArticle.imageAlt}
                    type={relatedArticle.type}
                    source="Infinite AI"
                    imageUrl={relatedArticle.imageUrl}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Scroll to Top */}
        <ScrollToTop />
      </ArticlePageWrapper>
    )
  } catch (error) {
    console.error('Error loading article:', error)
    notFound()
  }
}
