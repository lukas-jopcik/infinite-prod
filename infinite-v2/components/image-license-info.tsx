import { ExternalLink, Copyright, User, Globe } from 'lucide-react'
import { Article } from '@/lib/api'

interface ImageLicenseInfoProps {
  article: Article
}

export function ImageLicenseInfo({ article }: ImageLicenseInfoProps) {
  // Skip rendering for news articles (they have their own image handling)
  if (article.category === 'news') {
    return null
  }
  
  // Show for all articles that have any license information
  // For APOD/weekly: show all available fields
  // For community: show Pexels license info
  // For APOD/weekly without license fields, show based on source
  const hasLicenseData = article.imageLicense || article.imageCreditText || article.imageCopyrightNotice
  const isApodOrWeekly = article.source === 'apod-rss' || article.source === 'esa-hubble' || article.source === 'esa-hubble-potw'
  
  if (!hasLicenseData && !isApodOrWeekly) {
    return null
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Copyright className="h-4 w-4" />
        <span>Licenčné informácie</span>
      </div>
      
      <div className="space-y-2 text-sm text-muted-foreground">
        {/* License */}
        {article.imageLicense && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Licencia:</span>
            <span className="text-foreground">{article.imageLicense}</span>
          </div>
        )}

        {/* Credit Text */}
        {article.imageCreditText && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Zdroj:</span>
            <span className="text-foreground">{article.imageCreditText}</span>
          </div>
        )}

        {/* Default license info for APOD/Weekly without license fields */}
        {!hasLicenseData && isApodOrWeekly && (
          <>
            <div className="flex items-center gap-2">
              <span className="font-medium">Licencia:</span>
              <span className="text-foreground">
                {article.source === 'apod-rss' ? 'Public Domain (NASA)' : 'ESA/Hubble License'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Zdroj:</span>
              <span className="text-foreground">
                {article.source === 'apod-rss' ? 'NASA Astronomy Picture of the Day' : 'ESA/Hubble Space Telescope'}
              </span>
            </div>
          </>
        )}

        {/* Photographer */}
        {article.imagePhotographer && article.imagePhotographerUrl && (
          <div className="flex items-center gap-2">
            <User className="h-3 w-3" />
            <span className="font-medium">Fotograf:</span>
            <a
              href={article.imagePhotographerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent/80 underline"
            >
              {article.imagePhotographer}
            </a>
          </div>
        )}

        {/* License Page */}
        {article.imageAcquireLicensePage && (
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3" />
            <span className="font-medium">Originál nájdete tu:</span>
            <a
              href={article.imageAcquireLicensePage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent/80 underline"
            >
              <ExternalLink className="inline h-3 w-3" />
            </a>
          </div>
        )}

        {/* Copyright Notice */}
        {article.imageCopyrightNotice && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Copyright className="h-3 w-3" />
              <span>{article.imageCopyrightNotice}</span>
            </div>
          </div>
        )}

        {/* Default copyright for APOD/Weekly without copyright notice */}
        {!article.imageCopyrightNotice && isApodOrWeekly && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Copyright className="h-3 w-3" />
              <span>
                {article.source === 'apod-rss' 
                  ? '© NASA / Public Domain' 
                  : '© ESA/Hubble & NASA'
                }
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
