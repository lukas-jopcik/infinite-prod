'use client'

import Link from 'next/link'
import { Article } from '@/lib/api'
import { formatDateShort } from '@/lib/date-utils'
import { ArrowUp, MessageCircle, Trophy } from 'lucide-react'

interface CommunityArticleCardProps {
  article: Article
}

export function CommunityArticleCard({ article }: CommunityArticleCardProps) {
  const isReddit = article.source?.includes('reddit.com')
  const isSpaceCom = article.source?.includes('space.com')
  
  const getSourceIcon = () => {
    if (isReddit) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-orange-500 rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <span className="text-xs text-orange-400">Reddit</span>
        </div>
      )
    }
    if (isSpaceCom) {
      return (
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-xs text-blue-400">Space.com</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-cyan-500 rounded-sm flex items-center justify-center">
          <span className="text-white text-xs font-bold">C</span>
        </div>
        <span className="text-xs text-cyan-400">Komunita</span>
      </div>
    )
  }

  const getEngagementStats = () => {
    if (!article.communityEngagement) return null
    
    const { upvotes, comments, awards, engagementScore } = article.communityEngagement
    
    return (
      <div className="flex items-center gap-3 text-xs text-slate-400">
        {upvotes && upvotes > 0 && (
          <div className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-orange-400" />
            <span className="text-orange-400">{upvotes.toLocaleString()}</span>
          </div>
        )}
        {comments && comments > 0 && (
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-blue-400" />
            <span className="text-blue-400">{comments.toLocaleString()}</span>
          </div>
        )}
        {awards && awards > 0 && (
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-400">{awards}</span>
          </div>
        )}
        {engagementScore && engagementScore > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-cyan-400 font-medium">Score: {engagementScore}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <Link 
      href={`/kategoria/komunita/${article.slug}`}
      className="group block"
    >
      <article className="community-article-card p-6 hover:scale-[1.02] transition-all duration-300">
        {/* Header with source badge and date */}
        <div className="flex items-center justify-between mb-4">
          <div className="engagement-badge">
            {getSourceIcon()}
          </div>
          <time className="text-xs text-slate-500">
            {formatDateShort(article.originalDate)}
          </time>
        </div>

        {/* Title with emoji support */}
        <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-cyan-300 transition-colors">
          {article.title}
        </h3>

        {/* Selected excerpt from community discussion */}
        {article.selectedExcerpt && (
          <blockquote className="community-quote mb-4">
            <p className="text-sm text-slate-300 italic">
              "{article.selectedExcerpt}"
            </p>
          </blockquote>
        )}

        {/* Engagement stats */}
        {getEngagementStats() && (
          <div className="mb-4">
            {getEngagementStats()}
          </div>
        )}

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-3">
          {article.perex}
        </p>

        {/* Footer with reading time and source link */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{article.readingTime}</span>
            <span>•</span>
            <span>Komunita</span>
          </div>
          
          {article.sourceUrl && (
            <div className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
              Pôvodný zdroj →
            </div>
          )}
        </div>

        {/* Discussion highlights preview */}
        {article.discussionHighlights && article.discussionHighlights.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 mb-2">
              Top komentáre ({article.discussionHighlights.length})
            </div>
            <div className="space-y-1">
              {article.discussionHighlights.slice(0, 2).map((highlight, index) => (
                <div key={index} className="text-xs text-slate-400 truncate">
                  {highlight}
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </Link>
  )
}
