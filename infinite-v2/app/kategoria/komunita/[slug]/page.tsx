import { redirect } from "next/navigation"
import { ArticlesAPI } from "@/lib/api"

interface CommunityPageProps {
  params: Promise<{ slug: string }>
}

// Generate static params for all community articles
export async function generateStaticParams() {
  try {
    // Fetch all komunita articles from API
    const response = await ArticlesAPI.getArticlesByCategory("komunita", 100)
    
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

export default async function CommunityArticlePage({ params }: CommunityPageProps) {
  const { slug } = await params
  
  // Redirect all community articles to /clanok/ URL structure
  redirect(`/clanok/${slug}`)
}
