import { HeroCarousel } from "@/components/hero-carousel"
import { ArticleCard } from "@/components/article-card"
import { NewsletterSignup } from "@/components/newsletter-signup"
import { ArticlesAPI } from "@/lib/api"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { generateMetadata as generateSEOMetadata } from "@/lib/seo"
import { WebsiteStructuredData } from "@/components/structured-data"
import { HomepageSkeleton } from "@/components/skeleton-loader"
import { AdContainer } from "@/components/ad-manager"
import { Suspense } from "react"
import type { Metadata } from "next"

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  // Get the latest article for dynamic OG image
  try {
    const latestArticle = await ArticlesAPI.getArticlesByCategory("objav-dna", 1)
    const article = latestArticle?.articles?.[0]
    
    if (article) {
      return generateSEOMetadata({
        title: "Objav dňa z vesmíru",
        description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii. Najnovšie informácie z NASA, ESA a Hubble teleskopu.",
        image: article.imageUrl,
        url: "/",
      })
    }
  } catch (error) {
    console.error('Error fetching latest article for homepage metadata:', error)
  }
  
  // Fallback to default metadata
  return generateSEOMetadata({
    title: "Objav dňa z vesmíru",
    description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii. Najnovšie informácie z NASA, ESA a Hubble teleskopu.",
    url: "/",
  })
}

async function HomePageContent() {
  // Use optimized GSI endpoints for each category
  let carouselArticles: any[] = [];
  let recentArticles: any[] = [];
  let discoveryArticles: any[] = [];
  let communityArticles: any[] = [];
  let weeklyArticles: any[] = [];
  
  try {
    // Fetch per-category lists in parallel
    const discoveryPromise = ArticlesAPI.getArticlesByCategory("objav-dna", 12).catch(() => ({ articles: [] }));
    // Get articles from other categories in parallel (including weekly picks)
    const [communityResponse, weeklyResponse] = await Promise.all([
      ArticlesAPI.getArticlesByCategory("news", 6).catch(() => ({ articles: [] })),
      ArticlesAPI.getArticlesByCategory("tyzdenny-vyber", 12).catch(() => ({ articles: [] })),
    ]);
    const discoveryResponse = await discoveryPromise;
    discoveryArticles = discoveryResponse?.articles || [];

    communityArticles = communityResponse?.articles || [];
    weeklyArticles = weeklyResponse?.articles || [];

    // Build carousel articles - one from each category in order: news, objav-dna, tyzdenny-vyber
    const newsArticle = communityArticles.find(a => a.imageUrl && a.imageUrl !== '/placeholder.svg');
    const discoveryArticle = discoveryArticles.find(a => a.imageUrl && a.imageUrl !== '/placeholder.svg');
    const weeklyArticle = weeklyArticles.find(a => a.imageUrl && a.imageUrl !== '/placeholder.svg');
    
    carouselArticles = [newsArticle, discoveryArticle, weeklyArticle].filter(Boolean);

    // Build combined latest across all categories for recent articles
    const combined = [
      ...discoveryArticles,
      ...weeklyArticles,
      ...communityArticles,
    ];
    combined.sort((a, b) => new Date(b.originalDate || b.publishedAt).getTime() - new Date(a.originalDate || a.publishedAt).getTime());
    
    // Exclude carousel articles from recent articles
    const carouselSlugs = carouselArticles.map(a => a.slug);
    recentArticles = combined.filter(a => !carouselSlugs.includes(a.slug)).slice(0, 9);
    
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    // Return error state instead of mock data
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold text-foreground mb-4">Chyba pri načítavaní článkov</h1>
        <p className="text-muted-foreground mb-4">Nepodarilo sa načítať články z API.</p>
        <p className="text-sm text-muted-foreground">Skúste obnoviť stránku alebo to skúste neskôr.</p>
      </div>
    );
  }

  // Safety check - if no articles are available, show a message
  if (carouselArticles.length === 0 && recentArticles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold text-foreground mb-4">Žiadne články nie sú dostupné</h1>
        <p className="text-muted-foreground">Skúste to neskôr.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <WebsiteStructuredData />
      {/* Preload carousel images for better LCP */}
      {carouselArticles.map((article, index) => (
        article?.imageUrl && (
          <link
            key={index}
            rel="preload"
            as="image"
            href={article.imageUrl}
            type="image/webp"
          />
        )
      ))}
      
      {/* Hero Carousel Section */}
      {carouselArticles.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <HeroCarousel articles={carouselArticles} />
        </section>
      )}

      {/* Recent Articles Grid - Moved up */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-3xl font-bold text-foreground">Najnovšie články</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recentArticles.map((article) => (
            <ArticleCard 
              key={article.slug} 
              slug={article.slug}
              title={article.title}
              perex={article.perex}
              category={article.category}
              date={article.originalDate || article.publishedAt}
              image={article.imageUrl || (article.category === 'komunita' ? null : '/placeholder-astronomy.jpg')}
              imageAlt={article.title}
              author={article.author}
              source="Infinite AI"
              type={article.category === 'objav-dna' ? 'discovery' : 'article'}
            />
          ))}
        </div>
      </section>

      {/* Discovery Grid Layout - Moved down */}
      <section className="border-y border-border bg-card/50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-foreground">Objav dňa</h2>
            <Button variant="ghost" asChild>
              <Link href="/kategoria/objav-dna" className="flex items-center gap-2">
                Všetky objavy
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {discoveryArticles.slice(0, 3).map((article) => (
              <ArticleCard 
                key={article.slug} 
                slug={article.slug}
                title={article.title}
                perex={article.perex}
                category={article.category}
                date={article.originalDate || article.publishedAt}
                image={article.imageUrl || (article.category === 'news' ? null : '/placeholder-astronomy.jpg')}
                imageAlt={article.title}
                author={article.author}
                source="Infinite AI"
                type={article.category === 'objav-dna' ? 'discovery' : 'article'}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Community Section */}
      {communityArticles.length > 0 && (
        <section className="border-y border-border bg-card/30 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-foreground">Vesmírne novinky</h2>
              <Button variant="ghost" asChild>
                <Link href="/kategoria/vesmirne-novinky" className="flex items-center gap-2">
                  Viac noviniek
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {communityArticles.slice(0, 3).map((article) => (
                <ArticleCard 
                  key={article.slug} 
                  slug={article.slug}
                  title={article.title}
                  perex={article.perex}
                  category={article.category}
                  date={article.originalDate || article.publishedAt}
                  image={article.imageUrl || (article.category === 'news' ? null : '/placeholder-astronomy.jpg')}
                  imageAlt={article.title}
                  author={article.author}
                  source="Infinite AI"
                  type={article.category === 'objav-dna' ? 'discovery' : 'article'}
                />
              ))}
            </div>
          </div>
        </section>
      )}


      {/* Test AdSense */}
      <section className="border-y border-border bg-card/30 py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <AdContainer position="header" />
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="border-y border-border bg-card/50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <NewsletterSignup />
        </div>
      </section>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomepageSkeleton />}>
      <HomePageContent />
    </Suspense>
  )
}
