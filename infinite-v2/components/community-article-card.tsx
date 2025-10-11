'use client'

import Link from 'next/link'
import { Article } from '@/lib/api'
import { formatDateShort } from '@/lib/date-utils'
import { ArrowUp, MessageCircle, Trophy } from 'lucide-react'
import { CategoryBadge } from '@/components/category-badge'

interface CommunityArticleCardProps {
  article: Article
}

export function CommunityArticleCard({ article }: CommunityArticleCardProps) {
  const href = `/clanok/${article.slug}`
  // Use consistent date formatting to avoid hydration mismatch
  const dateString = article.originalDate || article.publishedAt
  const formattedDate = dateString ? new Date(dateString).toLocaleDateString('sk-SK') : ''
  const { upvotes, comments, awards, engagementScore } = article.communityEngagement || {}

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg cursor-pointer h-full"
      prefetch={true}
    >
      {article.imageUrl && (
        <div className="relative h-48 w-full overflow-hidden">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-col p-6 flex-grow">
        <div className="mb-2 flex items-center justify-between gap-2">
          <CategoryBadge category={article.category} />
          <time dateTime={article.originalDate || article.publishedAt} className="text-sm text-slate-400">
            {formattedDate}
          </time>
        </div>
        <h3 className="mb-3 text-2xl font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
          {article.title}
        </h3>
        <p className="mb-4 text-muted-foreground text-base flex-grow">
          {article.perex}
        </p>
        {article.selectedExcerpt && (
          <blockquote className="community-quote mb-4 text-sm text-slate-300">
            {article.selectedExcerpt}
          </blockquote>
        )}
        {article.communityEngagement && (
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
        )}
      </div>
    </Link>
  )
}
