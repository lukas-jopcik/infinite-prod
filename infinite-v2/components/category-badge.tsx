import { cn } from "@/lib/utils"

interface CategoryBadgeProps {
  category: string
  className?: string
}

const categoryColors: Record<string, string> = {
  "objav-dna": "bg-accent/20 text-accent border-accent/40",
  news: "bg-blue-100 text-blue-800 border-blue-300",
  "tyzdenny-vyber": "bg-chart-4/20 text-chart-4 border-chart-4/40",
}

const categoryLabels: Record<string, string> = {
  "objav-dna": "Objav Dňa",
  "tyzdenny-vyber": "Týždenný výber",
  "news": "Vesmírne novinky",
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const colorClass = categoryColors[category] || "bg-secondary text-secondary-foreground border-border"
  const label = categoryLabels[category] || category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold", colorClass, className)}
    >
      {label}
    </span>
  )
}
