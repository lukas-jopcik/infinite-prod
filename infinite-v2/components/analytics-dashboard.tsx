'use client'

import { useState, useEffect } from 'react'
import { useAnalytics } from './google-analytics'

interface AnalyticsData {
  pageViews: number
  uniqueVisitors: number
  bounceRate: number
  avgSessionDuration: number
  topPages: Array<{ page: string; views: number }>
  topCategories: Array<{ category: string; views: number }>
  deviceTypes: Array<{ device: string; percentage: number }>
  trafficSources: Array<{ source: string; percentage: number }>
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const { trackEvent } = useAnalytics()

  useEffect(() => {
    // Simulate fetching analytics data
    // In a real implementation, this would fetch from your analytics API
    const fetchAnalyticsData = async () => {
      try {
        // Track dashboard view
        trackEvent('analytics_dashboard_view', {
          dashboard_type: 'overview'
        })

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        setData({
          pageViews: 15420,
          uniqueVisitors: 8930,
          bounceRate: 42.5,
          avgSessionDuration: 3.2,
          topPages: [
            { page: '/', views: 3240 },
            { page: '/kategoria/objav-dna', views: 2890 },
            { page: '/objav-dna/veil-nebula', views: 1560 },
            { page: '/objav-dna/ngc-6357', views: 1230 },
            { page: '/o-projekte', views: 890 }
          ],
          topCategories: [
            { category: 'objav-dna', views: 8920 },
            { category: 'news', views: 2340 },
            { category: 'vzdelavanie', views: 1270 }
          ],
          deviceTypes: [
            { device: 'Desktop', percentage: 58.2 },
            { device: 'Mobile', percentage: 35.7 },
            { device: 'Tablet', percentage: 6.1 }
          ],
          trafficSources: [
            { source: 'Organic Search', percentage: 45.3 },
            { source: 'Direct', percentage: 28.7 },
            { source: 'Social Media', percentage: 15.2 },
            { source: 'Referral', percentage: 10.8 }
          ]
        })
      } catch (error) {
        console.error('Error fetching analytics data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [trackEvent])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Nepodarilo sa načítať analytické údaje.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Zobrazenia stránok"
          value={data.pageViews.toLocaleString()}
          change="+12.5%"
          changeType="positive"
        />
        <MetricCard
          title="Jedineční návštevníci"
          value={data.uniqueVisitors.toLocaleString()}
          change="+8.3%"
          changeType="positive"
        />
        <MetricCard
          title="Miera odchodu"
          value={`${data.bounceRate}%`}
          change="-2.1%"
          changeType="positive"
        />
        <MetricCard
          title="Priemerná dĺžka relácie"
          value={`${data.avgSessionDuration} min`}
          change="+0.4 min"
          changeType="positive"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Najobľúbenejšie stránky">
          <TopPagesChart data={data.topPages} />
        </ChartCard>
        
        <ChartCard title="Kategórie obsahu">
          <TopCategoriesChart data={data.topCategories} />
        </ChartCard>
        
        <ChartCard title="Typy zariadení">
          <DeviceTypesChart data={data.deviceTypes} />
        </ChartCard>
        
        <ChartCard title="Zdroje návštevnosti">
          <TrafficSourcesChart data={data.trafficSources} />
        </ChartCard>
      </div>
    </div>
  )
}

// Metric Card Component
interface MetricCardProps {
  title: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
}

function MetricCard({ title, value, change, changeType }: MetricCardProps) {
  const changeColor = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-muted-foreground'
  }[changeType]

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
      <div className={`text-sm ${changeColor}`}>{change}</div>
    </div>
  )
}

// Chart Card Component
interface ChartCardProps {
  title: string
  children: React.ReactNode
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

// Top Pages Chart
interface TopPagesChartProps {
  data: Array<{ page: string; views: number }>
}

function TopPagesChart({ data }: TopPagesChartProps) {
  const maxViews = Math.max(...data.map(item => item.views))

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground truncate">
              {item.page}
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-1">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(item.views / maxViews) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground ml-4">
            {item.views.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

// Top Categories Chart
interface TopCategoriesChartProps {
  data: Array<{ category: string; views: number }>
}

function TopCategoriesChart({ data }: TopCategoriesChartProps) {
  const maxViews = Math.max(...data.map(item => item.views))

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground capitalize">
              {item.category.replace('-', ' ')}
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-1">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${(item.views / maxViews) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-sm text-muted-foreground ml-4">
            {item.views.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

// Device Types Chart
interface DeviceTypesChartProps {
  data: Array<{ device: string; percentage: number }>
}

function DeviceTypesChart({ data }: DeviceTypesChartProps) {
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{item.device}</span>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-12 text-right">
              {item.percentage}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Traffic Sources Chart
interface TrafficSourcesChartProps {
  data: Array<{ source: string; percentage: number }>
}

function TrafficSourcesChart({ data }: TrafficSourcesChartProps) {
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{item.source}</span>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-muted rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-12 text-right">
              {item.percentage}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
