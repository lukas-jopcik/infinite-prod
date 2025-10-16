import Link from "next/link"
import { Fragment } from "react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  // Function to truncate title on mobile
  const truncateTitle = (title: string, isLastItem: boolean) => {
    if (!isLastItem) return title;
    
    const words = title.split(' ');
    if (words.length <= 3) return title;
    
    return `${words.slice(0, 3).join(' ')}...`;
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-3 text-sm">
      {items.map((item, index) => {
        const isLastItem = index === items.length - 1;
        const displayLabel = truncateTitle(item.label, isLastItem);
        
        return (
          <Fragment key={index}>
            {index > 0 && (
              <div className="flex items-center">
                <div className="h-1 w-1 rounded-full bg-blue-400/60 animate-pulse" />
                <div className="h-px w-2 bg-gradient-to-r from-blue-400/40 to-transparent" />
              </div>
            )}
            {item.href ? (
              <Link 
                href={item.href} 
                className="group relative text-muted-foreground/80 transition-all duration-300 hover:text-blue-300 hover:scale-105 cursor-pointer px-2 py-1 rounded-md hover:bg-blue-500/10 hover:shadow-sm hover:shadow-blue-500/20 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl" 
                prefetch={true} 
                scroll={true} 
                shallow={false}
              >
                <span className="relative z-10 block truncate" title={item.label}>{displayLabel}</span>
                <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            ) : (
              <span className="relative text-foreground font-semibold px-2 py-2 rounded-md bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-sm shadow-blue-500/10 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl">
                <span className="relative z-10 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent block whitespace-normal break-words leading-tight" title={item.label}>
                  {displayLabel}
                </span>
                <div className="absolute inset-0 rounded-md bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse" />
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  )
}
