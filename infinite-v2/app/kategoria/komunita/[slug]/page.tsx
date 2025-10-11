import { redirect } from "next/navigation"

interface CommunityPageProps {
  params: Promise<{ slug: string }>
}

export default async function CommunityArticlePage({ params }: CommunityPageProps) {
  const { slug } = await params
  
  // Redirect all community articles to /clanok/ URL structure
  redirect(`/clanok/${slug}`)
}
