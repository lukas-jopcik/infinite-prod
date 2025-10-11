import { notFound } from "next/navigation"
import Image from "next/image"
import { ArticlesAPI, Article, ArticleDetail } from "@/lib/api"
import { generateArticleMetadata } from "@/lib/seo"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { ScrollToTop } from "@/components/scroll-to-top"
import { ArticleStructuredData, BreadcrumbStructuredData, FAQStructuredData, ImageObjectStructuredData } from "@/components/structured-data"
import { ArticlePageWrapper, SocialSharingSection } from "@/components/article-page-wrapper"
import { generateArticleAltText } from "@/lib/alt-text-generator"
import { AdContainer } from "@/components/ad-manager"
import { Calendar, ExternalLink, ArrowUp, MessageCircle, Trophy } from "lucide-react"
import type { Metadata } from "next"

interface CommunityPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: CommunityPageProps): Promise<Metadata> {
  const { slug } = await params
  
  try {
    const article = await ArticlesAPI.getArticleBySlug(slug)

    if (!article) {
      return {
        title: "Článok nenájdený | Infinite",
        description: "Požadovaný článok nebol nájdený.",
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
  } catch (error) {
    return {
      title: "Článok nenájdený | Infinite",
      description: "Požadovaný článok nebol nájdený.",
    }
  }
}

export default async function CommunityArticlePage({ params }: CommunityPageProps) {
  const { slug } = await params
  
  let article: ArticleDetail | null = null
  
  try {
    article = await ArticlesAPI.getArticleBySlug(slug)
  } catch (error) {
    console.error('Error fetching article:', error)
  }

  if (!article) {
    notFound()
  }

  // Generate alt text for the main image
  const mainImageAlt = generateArticleAltText({
    title: article.title,
    category: article.category,
    source: article.source || 'Komunita'
  })


  const getEngagementStats = () => {
    if (!article.communityEngagement) return null
    
    const { upvotes, comments, awards, engagementScore } = article.communityEngagement
    
    return (
      <div className="flex items-center gap-4 text-sm">
        {upvotes && upvotes > 0 && (
          <div className="flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 font-medium">{upvotes.toLocaleString()} upvotes</span>
          </div>
        )}
        {comments && comments > 0 && (
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 font-medium">{comments.toLocaleString()} komentárov</span>
          </div>
        )}
        {awards && awards > 0 && (
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-medium">{awards} ocenení</span>
          </div>
        )}
        {engagementScore && engagementScore > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-medium">Engagement Score: {engagementScore}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <ArticlePageWrapper article={article}>
      {/* Breadcrumbs */}
      <div className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <Breadcrumbs 
            items={[
              { label: "Domov", href: "/" },
              { label: "Komunita", href: "/kategoria/komunita" },
              { label: article.title }
            ]} 
          />
        </div>
      </div>

      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Article Header */}
        <header className="mb-8">
          {/* Date */}
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <time dateTime={article.originalDate}>
                {new Date(article.originalDate).toLocaleDateString('sk-SK', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </time>
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-4 text-4xl font-bold text-foreground lg:text-5xl">
            {article.title}
          </h1>

          {/* Engagement Stats */}
          {getEngagementStats() && (
            <div className="mb-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg">
              {getEngagementStats()}
            </div>
          )}

          {/* Selected Excerpt */}
          {article.selectedExcerpt && (
            <blockquote className="community-quote mb-6">
              <p className="text-lg text-slate-300 italic">
                "{article.selectedExcerpt}"
              </p>
            </blockquote>
          )}

          {/* Perex */}
          <div className="text-lg text-muted-foreground leading-relaxed mb-6">
            {article.perex}
          </div>

          {/* Source Link */}
          {article.sourceUrl && (
            <div className="mb-6">
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Pôvodný zdroj
              </a>
            </div>
          )}
        </header>

        {/* Main Image */}
        {article.imageUrl && (
          <div className="mb-8">
            <div className="relative aspect-video overflow-hidden rounded-2xl">
              <Image
                src={article.imageUrl}
                alt={mainImageAlt}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
            </div>
          </div>
        )}

        {/* Article Content */}
        <div className="prose prose-lg prose-slate dark:prose-invert max-w-none">
          {article.content?.map((section, index) => (
            <section key={index} className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {section.title}
              </h2>
              <div 
                className="text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            </section>
          ))}
        </div>

        {/* Discussion Highlights */}
        {article.discussionHighlights && article.discussionHighlights.length > 0 && (
          <div className="mt-12 p-6 bg-slate-900/50 border border-slate-700/50 rounded-xl">
            <h3 className="text-xl font-bold text-foreground mb-4">
              Najzaujímavejšie komentáre z diskusie 💬
            </h3>
            <div className="space-y-4">
              {article.discussionHighlights.map((highlight, index) => (
                <div key={index} className="discussion-highlight">
                  <p className="text-slate-300">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ Section */}
        {article.faq && article.faq.length > 0 && (
          <div className="mt-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Často kladené otázky
            </h3>
            <div className="space-y-4">
              {article.faq.map((faq, index) => (
                <div key={index} className="border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">
                    {faq.question}
                  </h4>
                  <p className="text-muted-foreground">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Sharing */}
        <SocialSharingSection 
          articleSlug={article.slug}
          articleTitle={article.title}
          url={`https://infinite.sk/kategoria/komunita/${article.slug}`}
        />

        {/* Ad Container */}
        <AdContainer position="article" />
      </article>

      {/* Newsletter CTA */}
      <div className="mt-12 rounded-2xl border border-border bg-gradient-to-br from-accent/5 to-accent/10 p-8 text-center">
        <h3 className="mb-2 text-2xl font-bold text-foreground">Nenechaj si ujsť žiadny objav</h3>
        <p className="mb-6 text-muted-foreground">Dostávaj Objav dňa priamo do svojej schránky každé ráno.</p>
        <NewsletterSignup />
      </div>

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
          { name: "Domov", url: "https://infinite.sk/" },
          { name: "Komunita", url: "https://infinite.sk/kategoria/komunita" },
          { name: article.title, url: `https://infinite.sk/kategoria/komunita/${article.slug}` }
        ]} 
      />
      {article.faq && article.faq.length > 0 && (
        <FAQStructuredData faqs={article.faq} />
      )}
      {article.imageUrl && (
        <ImageObjectStructuredData 
          image={{
            url: article.imageUrl,
            alt: mainImageAlt,
            caption: article.title,
            creator: article.source || 'Komunita',
          }}
        />
      )}

      <ScrollToTop />
    </ArticlePageWrapper>
  )
}
