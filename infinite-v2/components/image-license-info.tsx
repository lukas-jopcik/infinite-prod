import { ExternalLink, Copyright, User, Globe } from 'lucide-react'
import { Article } from '@/lib/api'

interface ImageLicenseInfoProps {
  article: Article
}

export function ImageLicenseInfo({ article }: ImageLicenseInfoProps) {
  // Only show if we have license information
  if (!article.imageLicense && !article.imageCreditText) {
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
            <span className="font-medium">Licenčná stránka:</span>
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
      </div>
    </div>
  )
}
