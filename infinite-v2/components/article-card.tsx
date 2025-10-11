import Link from "next/link"
import Image from "next/image"
import { CategoryBadge } from "./category-badge"
import { Calendar } from "lucide-react"
import { formatDateShort, formatDateForDateTime } from "@/lib/date-utils"
import { generateThumbnailAltText } from "@/lib/alt-text-generator"

interface ArticleCardProps {
  slug: string
  title: string
  perex: string
  category: string
  date: string
  image: string
  imageAlt: string
  type: "article" | "discovery"
  author?: string
  source?: string
}

export function ArticleCard({ slug, title, perex, category, date, image, imageAlt, type, source = "Infinite AI" }: ArticleCardProps) {
  // Determine correct URL based on category
  const getHref = () => {
    if (category === 'tyzdenny-vyber') {
      return `/tyzdenny-vyber/${slug}`
    } else if (type === "discovery") {
      return `/objav-dna/${slug}`
    } else {
      return `/clanok/${slug}`
    }
  }
  
  const href = getHref()
  
  // Use consistent date formatting to prevent hydration mismatches
  const formattedDate = formatDateShort(date)
  const dateTimeValue = formatDateForDateTime(date)
  
  // Generate optimized alt text
  const optimizedAltText = generateThumbnailAltText({
    title,
    category,
    source,
  })

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:shadow-lg cursor-pointer"
      prefetch={true}
      scroll={true}
      shallow={false}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Image
          src={image || "/placeholder.svg"}
          alt={optimizedAltText}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          quality={60}
          loading="lazy"
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <CategoryBadge category={category} />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <time dateTime={dateTimeValue}>{formattedDate}</time>
          </div>
        </div>
        <h3 className="text-balance text-xl font-bold leading-tight text-card-foreground transition-colors group-hover:text-accent">
          {title}
        </h3>
        <p className="line-clamp-2 text-pretty text-sm leading-relaxed text-muted-foreground">{perex}</p>
      </div>
    </Link>
  )
}
