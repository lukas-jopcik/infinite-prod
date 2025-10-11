/**
 * Alt text generator for better SEO and accessibility
 */

export interface AltTextOptions {
  title: string
  category: string
  source?: string
  isHero?: boolean
  isThumbnail?: boolean
}

/**
 * Generate optimized alt text for images based on content context
 */
export function generateAltText(options: AltTextOptions): string {
  const { title, category, source, isHero = false, isThumbnail = false } = options

  // Validate required fields
  if (!title || typeof title !== 'string') {
    return 'Obrázok článku o vesmíre'
  }

  // Base alt text with title
  let altText = title.trim()

  // Add context based on image type
  if (isHero) {
    altText = `Hlavný obrázok: ${title}`
  } else if (isThumbnail) {
    altText = `Náhľad článku: ${title}`
  }

  // Add category context
  if (category && typeof category === 'string') {
    const categoryContext = getCategoryContext(category)
    if (categoryContext) {
      altText += ` - ${categoryContext}`
    }
  }

  // Add source context if available
  if (source && typeof source === 'string') {
    const sourceContext = getSourceContext(source)
    if (sourceContext) {
      altText += ` (${sourceContext})`
    }
  }

  // Ensure alt text is not too long (max 125 characters for SEO)
  if (altText.length > 125) {
    altText = altText.substring(0, 122) + '...'
  }

  return altText
}

/**
 * Get category context for alt text
 */
function getCategoryContext(category: string): string {
  if (!category || typeof category !== 'string') {
    return 'článok o vesmíre'
  }

  const categoryMap: Record<string, string> = {
    'objav-dna': 'objav dňa z vesmíru',
    'tyzdenny-vyber': 'týždenný výber',
    'komunita': 'komunitný príspevok',
    'vysvetlenia': 'vysvetlenie',
  }

  return categoryMap[category] || 'článok o vesmíre'
}

/**
 * Get source context for alt text
 */
function getSourceContext(source: string): string {
  if (!source || typeof source !== 'string') {
    return 'Infinite AI'
  }

  const sourceMap: Record<string, string> = {
    'apod-rss': 'NASA APOD',
    'esa-hubble': 'ESA Hubble',
    'nasa': 'NASA',
    'esa': 'ESA',
    'hubble': 'Hubble Space Telescope',
    'jwst': 'James Webb Space Telescope',
  }

  return sourceMap[source] || source
}

/**
 * Generate alt text for article images
 */
export function generateArticleAltText(article: {
  title: string
  category: string
  source?: string
}): string {
  return generateAltText({
    title: article.title || 'Článok o vesmíre',
    category: article.category || 'objav-dna',
    source: article.source,
    isHero: true,
  })
}

/**
 * Generate alt text for thumbnail images
 */
export function generateThumbnailAltText(article: {
  title: string
  category: string
  source?: string
}): string {
  return generateAltText({
    title: article.title || 'Článok o vesmíre',
    category: article.category || 'objav-dna',
    source: article.source,
    isThumbnail: true,
  })
}

/**
 * Generate alt text for category images
 */
export function generateCategoryAltText(category: string): string {
  if (!category || typeof category !== 'string') {
    return 'Kategória článkov o vesmíre'
  }

  const categoryMap: Record<string, string> = {
    'objav-dna': 'Objav dňa z vesmíru - denné astronomické objavy',
    'tyzdenny-vyber': 'Týždenný výber - najlepšie články z vesmíru',
    'komunita': 'Komunita - príspevky od čitateľov',
    'vysvetlenia': 'Vysvetlenia - komplexné témy jednoducho',
  }

  return categoryMap[category] || `Kategória ${category} - články o vesmíre`
}
