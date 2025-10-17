"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Article } from "@/lib/mock-data"

interface DiscoveryCarouselProps {
  articles: Article[]
}

export function DiscoveryCarousel({ articles }: DiscoveryCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? articles.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === articles.length - 1 ? 0 : prev + 1))
  }

  if (articles.length === 0) return null

  const currentArticle = articles[currentIndex]

  return (
    <div className="relative">
      {/* Main Carousel */}
      <div className="relative overflow-hidden rounded-2xl">
        <Link href={`/objav-dna/${currentArticle.slug}`} className="group block" prefetch={true} scroll={true} shallow={false}>
          <div className="relative aspect-[21/6] bg-muted">
            <Image
              src={currentArticle.image || "/placeholder.svg"}
              alt={currentArticle.imageAlt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
              quality={70}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="mx-auto max-w-4xl">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  {new Date(currentArticle.date).toLocaleDateString("sk-SK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h3 className="text-balance text-3xl font-bold text-foreground transition-colors group-hover:text-accent lg:text-4xl">
                  {currentArticle.title}
                </h3>
              </div>
            </div>
          </div>
        </Link>

        {/* Navigation Buttons */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full"
          onClick={goToPrevious}
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="sr-only">Predchádzajúci</span>
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full"
          onClick={goToNext}
        >
          <ChevronRight className="h-5 w-5" />
          <span className="sr-only">Ďalší</span>
        </Button>
      </div>

      {/* Dots Indicator */}
      <div className="mt-6 flex justify-center gap-2">
        {articles.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              "h-2 rounded-full transition-all",
              index === currentIndex ? "w-8 bg-foreground" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
            aria-label={`Prejsť na snímku ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
