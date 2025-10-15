/**
 * SEO utilities for Slovak bulvár content
 * Handles keyword extraction, metadata generation, and slug creation
 */

// Slovak stop words for keyword extraction
const SLOVAK_STOP_WORDS = new Set([
  "a", "aj", "ale", "ako", "na", "do", "sa", "s", "z", "že", "v", "vo", "o", "k", "ku", 
  "od", "pod", "nad", "pri", "pre", "či", "už", "je", "to", "ten", "tá", "to", "ktorý", 
  "ktorá", "ktoré", "sú", "bol", "bola", "bolo", "by", "bude", "budú", "bude", "som", 
  "si", "sme", "ste", "sú", "mám", "máš", "má", "máme", "máte", "majú", "mal", "mala", 
  "malo", "mali", "budem", "budeš", "bude", "budeme", "budete", "budú", "môžem", "môžeš", 
  "môže", "môžeme", "môžete", "môžu", "musím", "musíš", "musí", "musíme", "musíte", "musia",
  "chcem", "chceš", "chce", "chceme", "chcete", "chcú", "môže", "môžu", "môžeme", "môžete"
]);

/**
 * Extract Slovak keywords from text
 * @param text - Text to extract keywords from
 * @param maxKeywords - Maximum number of keywords to return
 * @returns Array of keywords
 */
export function extractKeywordsSK(text: string, maxKeywords: number = 12): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Normalize text: remove diacritics, convert to lowercase, clean
  const normalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into words and filter
  const words = normalizedText
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !SLOVAK_STOP_WORDS.has(word) &&
      !/^\d+$/.test(word) // Remove pure numbers
    );

  // Count word frequency
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // Sort by frequency and get top keywords
  const sortedWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  // Add some diacritics back for better SEO
  const keywordsWithDiacritics = sortedWords.map(word => 
    addDiacriticsBack(word)
  );

  // Remove duplicates and return
  return Array.from(new Set(keywordsWithDiacritics));
}

/**
 * Add diacritics back to common Slovak words
 * @param word - Word without diacritics
 * @returns Word with diacritics
 */
function addDiacriticsBack(word: string): string {
  const diacriticsMap: Record<string, string> = {
    'vesmir': 'vesmír',
    'astronomia': 'astronómia',
    'galaxia': 'galaxia',
    'planeta': 'planéta',
    'hviezda': 'hviezda',
    'mesiac': 'mesiac',
    'slunce': 'slnko',
    'slnko': 'slnko',
    'kometa': 'kométa',
    'teleskop': 'teleskop',
    'raketa': 'raketa',
    'satelit': 'satelit',
    'orbit': 'orbita',
    'atmosfera': 'atmosféra',
    'gravitacia': 'gravitácia',
    'energia': 'energia',
    'materia': 'materia',
    'svetlo': 'svetlo',
    'temnota': 'temnota',
    'vyskum': 'výskum',
    'objav': 'objav',
    'veda': 'veda',
    'technologia': 'technológia',
    'nasa': 'NASA',
    'esa': 'ESA',
    'spacex': 'SpaceX',
    'hubble': 'Hubble',
    'webb': 'Webb'
  };

  return diacriticsMap[word] || word;
}

/**
 * Clamp string to maximum length
 * @param str - String to clamp
 * @param maxLength - Maximum length
 * @returns Clamped string
 */
export function clamp(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1).trimEnd() + '…';
}

/**
 * Build SEO metadata for bulvár articles
 * @param data - Article data
 * @returns SEO metadata
 */
export function buildBulvarMeta(data: {
  headline: string;
  perex: string;
  body?: string[];
}): {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  slug: string;
} {
  const { headline, perex, body = [] } = data;
  
  // Generate meta title (≤60 characters)
  const metaTitle = clamp(headline, 60);
  
  // Generate meta description (140-160 characters)
  const metaDescription = clamp(perex, 155);
  
  // Extract keywords from headline, perex, and body
  const fullText = `${headline} ${perex} ${body.join(' ')}`;
  const keywords = extractKeywordsSK(fullText, 12);
  
  // Generate slug from headline
  const slug = generateSlug(headline);
  
  return {
    metaTitle,
    metaDescription,
    keywords,
    slug
  };
}

/**
 * Generate kebab-case slug from Slovak text
 * @param text - Text to convert to slug
 * @returns Kebab-case slug
 */
export function generateSlug(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60); // Limit length
}

/**
 * Generate JSON-LD structured data for articles
 * @param article - Article data
 * @returns JSON-LD object
 */
export function generateArticleStructuredData(article: {
  headline: string;
  perex: string;
  imageUrl?: string;
  publishedAt: string;
  author?: string;
  category: string;
  url?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.headline,
    "description": article.perex,
    "image": article.imageUrl ? [article.imageUrl] : undefined,
    "datePublished": article.publishedAt,
    "author": article.author ? {
      "@type": "Person",
      "name": article.author
    } : undefined,
    "articleSection": article.category,
    "url": article.url,
    "publisher": {
      "@type": "Organization",
      "name": "Infinite",
      "url": "https://infinite.sk"
    }
  };
}

/**
 * Generate Open Graph metadata
 * @param article - Article data
 * @returns Open Graph object
 */
export function generateOpenGraphMeta(article: {
  headline: string;
  perex: string;
  imageUrl?: string;
  publishedAt: string;
  category: string;
  url?: string;
}): Record<string, string> {
  return {
    'og:title': article.headline,
    'og:description': article.perex,
    'og:image': article.imageUrl || '',
    'og:type': 'article',
    'og:url': article.url || '',
    'og:site_name': 'Infinite',
    'article:published_time': article.publishedAt,
    'article:section': article.category
  };
}

/**
 * Generate Twitter Card metadata
 * @param article - Article data
 * @returns Twitter Card object
 */
export function generateTwitterCardMeta(article: {
  headline: string;
  perex: string;
  imageUrl?: string;
}): Record<string, string> {
  return {
    'twitter:card': 'summary_large_image',
    'twitter:title': article.headline,
    'twitter:description': article.perex,
    'twitter:image': article.imageUrl || '',
    'twitter:site': '@infinite_sk'
  };
}
