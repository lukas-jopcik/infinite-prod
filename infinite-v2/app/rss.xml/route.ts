import { NextResponse } from 'next/server'
import { ArticlesAPI } from '@/lib/api'

export async function GET() {
  const baseUrl = 'https://infinite.sk'
  const siteName = 'Infinite'
  const siteDescription = 'Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii.'

  try {
    // Fetch latest articles from all categories
    const [objavDnaResponse, newsResponse, tyzdennyResponse, aiDiscoveriesResponse] = await Promise.all([
      ArticlesAPI.getArticlesByCategory("objav-dna", 20).catch(() => ({ articles: [] })),
      ArticlesAPI.getArticlesByCategory("news", 10).catch(() => ({ articles: [] })),
      ArticlesAPI.getArticlesByCategory("tyzdenny-vyber", 10).catch(() => ({ articles: [] })),
      ArticlesAPI.getArticlesByCategory("ai-discoveries", 10).catch(() => ({ articles: [] })),
    ])

    // Combine all articles and sort by date
    const allArticles = [
      ...objavDnaResponse.articles,
      ...newsResponse.articles,
      ...tyzdennyResponse.articles,
      ...aiDiscoveriesResponse.articles,
    ].sort((a, b) => 
      new Date(b.originalDate || b.publishedAt).getTime() - 
      new Date(a.originalDate || a.publishedAt).getTime()
    )

    // Generate RSS XML
    const rssItems = allArticles.slice(0, 50).map(article => {
      const pubDate = new Date(article.originalDate || article.publishedAt).toUTCString()
      // Use correct URL based on category
      let basePath = 'vesmirne-novinky' // Default for news articles
      
      if (article.category === 'tyzdenny-vyber') {
        basePath = 'tyzdenny-vyber'
      } else if (article.category === 'objav-dna') {
        basePath = 'objav-dna'
      } else if (article.category === 'ai-discoveries') {
        basePath = 'vesmirne-objavy'
      }
      // News articles and others use 'vesmirne-novinky'
      
      const articleUrl = `${baseUrl}/${basePath}/${article.slug}`
      const imageUrl = article.imageUrl ? `${baseUrl}${article.imageUrl}` : `${baseUrl}/opengraph-image.png`
      
      // Clean description - remove HTML tags and limit length
      const cleanDescription = article.perex
        .replace(/<[^>]*>/g, '')
        .replace(/&[^;]+;/g, ' ')
        .substring(0, 300)
        .trim()

      return `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <description><![CDATA[${cleanDescription}]]></description>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <category><![CDATA[${article.category}]]></category>
      <author><![CDATA[${article.author || 'Infinite AI'}]]></author>
      <enclosure url="${imageUrl}" type="image/jpeg" length="0"/>
    </item>`
    }).join('')

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="https://www.w3.org/2005/Atom" xmlns:content="https://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${siteName} - Objav dňa z vesmíru]]></title>
    <description><![CDATA[${siteDescription}]]></description>
    <link>${baseUrl}</link>
    <language>sk</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/opengraph-image.png</url>
      <title><![CDATA[${siteName}]]></title>
      <link>${baseUrl}</link>
      <width>1200</width>
      <height>1200</height>
    </image>
    <managingEditor>info@infinite.sk (Infinite Team)</managingEditor>
    <webMaster>info@infinite.sk (Infinite Team)</webMaster>
    <generator>Next.js RSS Generator</generator>
    <ttl>60</ttl>
    ${rssItems}
  </channel>
</rss>`

    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error generating RSS feed:', error)
    
    // Return minimal RSS feed on error
    const fallbackRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="https://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${siteName} - Objav dňa z vesmíru]]></title>
    <description><![CDATA[${siteDescription}]]></description>
    <link>${baseUrl}</link>
    <language>sk</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
  </channel>
</rss>`

    return new NextResponse(fallbackRss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300', // Cache for 5 minutes on error
      },
    })
  }
}
