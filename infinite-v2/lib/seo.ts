import type { Metadata } from "next"

export interface ArticleData {
  title: string
  description: string
  slug: string
  imageUrl?: string
  publishedAt: string
  originalDate?: string
  author?: string
  category: string
  tags?: string[]
  content?: string
}

export interface SEOConfig {
  title: string
  description: string
  image?: string
  type?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
  author?: string
  section?: string
  tags?: string[]
  url?: string
  canonical?: string
}

const SITE_CONFIG = {
  name: "Infinite",
  description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii.",
  url: "https://infinite.sk",
  locale: "sk_SK",
  twitter: "@infinite_sk",
  defaultImage: "/og-default.jpg",
}

export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    image = SITE_CONFIG.defaultImage,
    type = "website",
    publishedTime,
    modifiedTime,
    author = "Infinite",
    section,
    tags,
    url,
    canonical,
  } = config

  const fullTitle = `${title} | ${SITE_CONFIG.name}`
  const fullDescription = description && description.trim() ? description : SITE_CONFIG.description
  const fullUrl = url ? `${SITE_CONFIG.url}${url}` : SITE_CONFIG.url
  const fullImage = image.startsWith('http') ? image : `${SITE_CONFIG.url}${image}`

  const metadata: Metadata = {
    title: fullTitle,
    description: fullDescription,
    keywords: tags ? tags.join(", ") : "astronómia, vesmír, objav dňa, hviezdy, planéty, galaxie, NASA, ESA, Hubble",
    authors: [{ name: author }],
    creator: SITE_CONFIG.name,
    publisher: SITE_CONFIG.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: canonical || fullUrl,
    },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      type,
      locale: SITE_CONFIG.locale,
      url: fullUrl,
      siteName: SITE_CONFIG.name,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(type === "article" && {
        publishedTime,
        modifiedTime,
        authors: [author],
        section,
        tags,
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDescription,
      images: [fullImage],
      creator: SITE_CONFIG.twitter,
      site: SITE_CONFIG.twitter,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }

  return metadata
}

export function generateArticleMetadata(article: ArticleData): Metadata {
  // Use correct URL based on category
  const basePath = article.category === 'tyzdenny-vyber' ? 'tyzdenny-vyber' : 'objav-dna'
  
  return generateMetadata({
    title: article.title,
    description: article.description || article.content || "Objav dňa z vesmíru na Infinite",
    image: article.imageUrl,
    type: "article",
    publishedTime: article.originalDate || article.publishedAt,
    modifiedTime: article.publishedAt,
    author: article.author || "Infinite",
    section: article.category,
    tags: article.tags,
    url: `/${basePath}/${article.slug}`,
  })
}

export function generateCategoryMetadata(category: string, description?: string): Metadata {
  const categoryNames: Record<string, string> = {
    "objav-dna": "Objav dňa",
    "komunita": "Komunita",
    "tyzdenny-vyber": "Týždenný výber",
  }

  const categoryName = categoryNames[category] || category
  const categoryDescription = description || `Prehľad článkov v kategórii ${categoryName} na Infinite.`

  return generateMetadata({
    title: categoryName,
    description: categoryDescription,
    url: `/kategoria/${category}`,
  })
}

export function generateHomepageMetadata(): Metadata {
  return generateMetadata({
    title: "Objav dňa z vesmíru",
    description: "Denné objavy, vizuálne snímky a vzdelávacie články o vesmíre a astronómii. Najnovšie informácie z NASA, ESA a Hubble teleskopu.",
    url: "/",
  })
}

// Structured Data (JSON-LD) generators
export function generateArticleStructuredData(article: ArticleData): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: article.imageUrl ? [article.imageUrl] : undefined,
    datePublished: article.originalDate || article.publishedAt,
    dateModified: article.publishedAt,
    author: {
      "@type": "Organization",
      name: article.author || "Infinite",
      url: SITE_CONFIG.url,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_CONFIG.url}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_CONFIG.url}/${article.category === 'tyzdenny-vyber' ? 'tyzdenny-vyber' : 'objav-dna'}/${article.slug}`,
    },
    articleSection: article.category,
    keywords: article.tags?.join(", "),
    inLanguage: "sk",
  }
}

export function generateWebsiteStructuredData(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.url,
    inLanguage: "sk",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_CONFIG.url}/hladat?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function generateOrganizationStructuredData(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    sameAs: [
      `https://twitter.com/${SITE_CONFIG.twitter.replace('@', '')}`,
    ],
  }
}

export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_CONFIG.url}${item.url}`,
    })),
  }
}

export function generateFAQStructuredData(faqs: Array<{ question: string; answer: string }>): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}

export function generateImageObjectStructuredData(image: {
  url: string
  alt: string
  caption?: string
  license?: string
  creator?: string
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    url: image.url.startsWith('http') ? image.url : `${SITE_CONFIG.url}${image.url}`,
    caption: image.caption || image.alt,
    name: image.alt,
    ...(image.license && { license: image.license }),
    ...(image.creator && { creator: { "@type": "Person", name: image.creator } }),
  }
}
