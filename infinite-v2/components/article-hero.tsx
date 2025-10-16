import Link from "next/link"
import Image from "next/image"
import { CategoryBadge } from "./category-badge"
import { Calendar, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDateShort, formatDateForDateTime } from "@/lib/date-utils"

interface ArticleHeroProps {
  slug: string
  title: string
  perex: string
  category: string
  date: string
  image: string
  imageAlt: string
  type?: "article" | "discovery"
}

export function ArticleHero({ slug, title, perex, category, date, image, imageAlt, type = "discovery" }: ArticleHeroProps) {
  // Use consistent date formatting to prevent hydration mismatches
  const formattedDate = formatDateShort(date)
  const dateTimeValue = formatDateForDateTime(date)
  
  // Generate correct href based on category
  const getHref = () => {
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
  
  const href = getHref()
  
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-card">
      <div className="grid gap-0 lg:grid-cols-2">
        {/* Image */}
        <div className="relative h-full min-h-[300px]">
          <Image 
            src={image || "/placeholder.svg"} 
            alt={imageAlt} 
            fill 
            priority 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px"
            className="object-cover object-center" 
            quality={75}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
          />
        </div>

        {/* Content */}
        <div className="flex flex-col justify-center gap-4 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <CategoryBadge category={category} />
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <time dateTime={dateTimeValue}>{formattedDate}</time>
            </div>
          </div>

          <h1 className="text-balance text-3xl font-bold leading-tight text-foreground lg:text-4xl">{title}</h1>

          <p className="text-pretty text-base leading-relaxed text-muted-foreground line-clamp-3">
            {perex.length > 200 ? `${perex.substring(0, 200)}...` : perex}
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
    </div>
  )
}
