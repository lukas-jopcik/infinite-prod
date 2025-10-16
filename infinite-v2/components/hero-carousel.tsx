'use client'

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { CategoryBadge } from "./category-badge"
import { Calendar, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateShort, formatDateForDateTime } from "@/lib/date-utils"

interface HeroCarouselProps {
  articles: Array<{
    slug: string
    title: string
    perex: string
    category: string
    originalDate?: string
    publishedAt?: string
    image: string
    imageAlt: string
    type?: "article" | "discovery" | "news"
  }>
}

export function HeroCarousel({ articles }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-rotation every 5 seconds
  useEffect(() => {
    if (!isAutoPlaying || articles.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % articles.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying, articles.length])

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? articles.length - 1 : prevIndex - 1
    )
  }, [articles.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % articles.length)
  }, [articles.length])

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsAutoPlaying(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsAutoPlaying(true)
  }, [])

  if (!articles || articles.length === 0) {
    return null
  }

  const currentArticle = articles[currentIndex]

  // Generate correct href based on category
  const getHref = (category: string, slug: string) => {
    if (category === 'tyzdenny-vyber') {
      return `/tyzdenny-vyber/${slug}`
    } else if (category === 'objav-dna') {
      return `/objav-dna/${slug}`
    } else if (category === 'news') {
      return `/vesmirne-novinky/${slug}`
    } else {
      return `/vesmirne-novinky/${slug}` // Default to news for other categories
    }
  }

  const href = getHref(currentArticle.category, currentArticle.slug)
  const articleDate = currentArticle.originalDate || currentArticle.publishedAt
  const formattedDate = formatDateShort(articleDate)
  const dateTimeValue = formatDateForDateTime(articleDate)

  return (
    <div 
      className="group relative overflow-hidden rounded-3xl bg-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="grid gap-0 lg:grid-cols-2">
        {/* Image */}
        <div className="relative h-full min-h-[300px]">
          <Image 
            src={currentArticle.image || "/placeholder.svg"} 
            alt={currentArticle.imageAlt} 
            fill 
            priority 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover object-center transition-opacity duration-500" 
            quality={80}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          />
          
          {/* Navigation Arrows */}
          {articles.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/30 p-2 text-white transition-all hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50 sm:left-4"
                aria-label="Previous article"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/30 p-2 text-white transition-all hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50 sm:right-4"
                aria-label="Next article"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-center gap-4 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <CategoryBadge category={currentArticle.category} />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <time dateTime={dateTimeValue}>{formattedDate}</time>
            </div>
          </div>

          <h1 className="text-balance text-3xl font-bold leading-tight text-foreground lg:text-4xl">
            {currentArticle.title}
          </h1>

          <p className="text-pretty text-base leading-relaxed text-muted-foreground line-clamp-3">
            {currentArticle.perex.length > 200 ? `${currentArticle.perex.substring(0, 200)}...` : currentArticle.perex}
          </p>

          <div>
            <Button size="lg" asChild>
              <Link href={href} className="flex items-center gap-2" prefetch={true} scroll={true} shallow={false}>
                Čítať článok
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      {articles.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {articles.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white scale-125' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
