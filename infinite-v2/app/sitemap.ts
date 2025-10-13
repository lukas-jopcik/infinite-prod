import { MetadataRoute } from 'next'
import { ArticlesAPI } from '@/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://infinite.sk'
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/kategoria/objav-dna`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/kategoria/komunita`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hladat`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/o-projekte`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/tyzdenny-vyber`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  try {
    // Fetch articles from all categories with increased limits for sitemap
    const [objavDnaResponse, komunitaResponse, tyzdennyResponse] = await Promise.all([
      ArticlesAPI.getArticlesByCategory("objav-dna", 1000).catch(() => ({ articles: [] })),
      ArticlesAPI.getArticlesByCategory("komunita", 200).catch(() => ({ articles: [] })),
      ArticlesAPI.getArticlesByCategory("tyzdenny-vyber", 200).catch(() => ({ articles: [] })),
    ])

    // Generate sitemap entries for all articles
    const allArticles = [
      ...objavDnaResponse.articles,
      ...komunitaResponse.articles,
      ...tyzdennyResponse.articles,
    ]

    const articlePages: MetadataRoute.Sitemap = allArticles.map((article) => {
      // Use correct URL structure based on category
      let basePath = 'clanok' // Default for community articles
      
      if (article.category === 'tyzdenny-vyber') {
        basePath = 'tyzdenny-vyber'
      } else if (article.category === 'objav-dna') {
        basePath = 'objav-dna'
      }
      // Community articles and others use 'clanok'
      
      return {
        url: `${baseUrl}/${basePath}/${article.slug}`,
        lastModified: new Date(article.originalDate || article.publishedAt),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }
    })

    return [...staticPages, ...articlePages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return static pages only if API fails
    return staticPages
  }
}
