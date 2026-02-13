import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAppSelector } from "../store/hooks"
import { categoryApi, Category, Service, serviceApi, statisticsApi } from "../services/api"
import { renderIcon } from "../utils/iconHelper"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  HeartHandshake,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react"

const StarRating = ({ rating, size = "h-3.5 w-3.5" }: { rating: number; size?: string }) => {
  // Calculate fill percentage (rating is out of 5, so rating/5 gives the percentage)
  const fillPercentage = Math.min(Math.max((rating / 5) * 100, 0), 100)
  
  return (
    <div className="relative inline-flex items-center">
      {/* Empty star (background) */}
      <Star className={`${size} text-muted-foreground/30`} />
      {/* Filled star (foreground, clipped based on percentage using mask) */}
      <div 
        className="absolute top-0 left-0"
        style={{ 
          width: `${fillPercentage}%`,
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <Star className={`${size} fill-yellow-400 text-yellow-400`} />
      </div>
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [categories, setCategories] = useState<Category[]>([])
  const [featuredServices, setFeaturedServices] = useState<Service[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statistics, setStatistics] = useState<{
    activeUsers: number | null;
    listings: number | null;
    verifiedSellers: number | null;
    satisfaction: number | null;
  }>({
    activeUsers: null,
    listings: null,
    verifiedSellers: null,
    satisfaction: null,
  })
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const [cats, featured, stats] = await Promise.all([
          categoryApi.getAll(),
          serviceApi.getAllPaginated({ page: 1, limit: 6, status: "active" }),
          statisticsApi.getStatistics().catch((err) => {
            console.error("Failed to load statistics:", err)
            return null
          }),
        ])

        if (cancelled) return
        setCategories(cats || [])
        // Sort services by rating (higher to lower) for "Popular right now" card
        const sortedServices = (featured.data || []).sort((a, b) => {
          // Use averageRating if available, otherwise fall back to rating field
          const ratingA = Number(a.averageRating ?? a.rating ?? 0)
          const ratingB = Number(b.averageRating ?? b.rating ?? 0)
          return ratingB - ratingA // Higher rating first
        })
        setFeaturedServices(sortedServices)
        if (stats) {
          setStatistics(stats)
        }
      } catch (error) {
        console.error("Failed to load landing data:", error)
      } finally {
        if (!cancelled) {
          setLoadingCategories(false)
          setLoadingFeatured(false)
          setLoadingStats(false)
        }
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSearch = () => {
    const q = searchQuery.trim()
    const target = q ? `/services?search=${encodeURIComponent(q)}` : "/services"
    if (!isAuthenticated) navigate(`/signin?redirect=${encodeURIComponent(target)}`)
    else navigate(target)
  }

  const guardedTo = (to: string) =>
    isAuthenticated ? to : `/signin?redirect=${encodeURIComponent(to)}`

  const guardedNavigate = (to: string) => {
    if (!isAuthenticated) navigate(`/signin?redirect=${encodeURIComponent(to)}`)
    else navigate(to)
  }

  const navCtas = useMemo(() => {
    if (isAuthenticated) {
      return (
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" asChild className="hidden sm:inline-flex">
          <Link to="/signin">Sign in</Link>
        </Button>
        <Button asChild>
          <Link to="/signup">Get started</Link>
        </Button>
      </div>
    )
  }, [isAuthenticated])

  // Helper function to round to nearest multiple of 10
  const roundToNearestTen = (value: number | null): number => {
    if (value === null || value === 0) return 0
    return Math.round(value / 10) * 10
  }

  const benefits = [
    {
      icon: ShieldCheck,
      title: "Secure transactions",
      description: "Protection and clear status tracking from start to finish.",
    },
    {
      icon: Users,
      title: "Built for community",
      description: "Discover creators, follow trends, and chat instantly.",
    },
    {
      icon: HeartHandshake,
      title: "Made for marketplaces",
      description: "Create listings, manage milestones, and get paid fast.",
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav (public landing) */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                O
              </span>
              <span>OmniMart</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" asChild className="gap-2">
                <Link to={guardedTo("/services")}>
                  <Compass className="h-4 w-4" />
                  Explore
                </Link>
              </Button>
              <Button variant="ghost" asChild className="gap-2">
                <Link to={guardedTo("/feed")}>
                  <TrendingUp className="h-4 w-4" />
                  Feed
                </Link>
              </Button>
              <Button variant="ghost" asChild className="gap-2">
                <Link to={guardedTo("/referral")}>
                  <Users className="h-4 w-4" />
                  Referral
                </Link>
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="hidden lg:flex" asChild>
              <Link to={guardedTo("/services")}>
                Browse services <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {navCtas}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="container mx-auto grid gap-10 px-4 py-12 md:grid-cols-2 md:items-center md:py-16 lg:py-20">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Marketplace + community in one place
            </Badge>

            <div className="space-y-3">
              <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Anyone can sell anything and buy anything.
              </h1>
              <p className="text-pretty text-base text-muted-foreground sm:text-lg">
                OmniMart combines a modern marketplace with a social feed—discover work, connect fast, and pay securely.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch()
                  }}
                  placeholder="Search services, skills, or keywords..."
                  className="h-11 pl-9"
                />
              </div>
              <Button onClick={handleSearch} className="h-11 gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Verified sellers
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Secure payments
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild className="gap-2">
                <Link to="/signup">
                  Create account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={guardedTo("/services")}>Explore listings</Link>
              </Button>
            </div>
          </div>

          <Card className="relative overflow-hidden">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Popular right now</CardTitle>
              <CardDescription>Quick picks from active listings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingFeatured ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : featuredServices.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4" />
                  No featured services yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {featuredServices.slice(0, 3).map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => guardedNavigate(`/services/${svc.id}`)}
                      className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{svc.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{svc.adText}</div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {svc.balance} USD
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <StarRating rating={Number(svc.averageRating ?? svc.rating ?? 0)} />
                          <span className="ml-0.5">{Number(svc.averageRating ?? svc.rating ?? 0).toFixed(1)}</span>
                        </span>
                        <span className="inline-flex items-center gap-2">
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Button variant="outline" asChild className="w-full">
                <Link to={guardedTo("/services")}>See all services</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { 
                label: "Active users", 
                value: loadingStats 
                  ? "..." 
                  : statistics.activeUsers !== null 
                    ? `${roundToNearestTen(statistics.activeUsers).toLocaleString()}+` 
                    : "0+" 
              },
              { 
                label: "Listings", 
                value: loadingStats 
                  ? "..." 
                  : statistics.listings !== null 
                    ? `${roundToNearestTen(statistics.listings).toLocaleString()}+` 
                    : "0+" 
              },
              { 
                label: "Verified sellers", 
                value: loadingStats 
                  ? "..." 
                  : statistics.verifiedSellers !== null 
                    ? `${roundToNearestTen(statistics.verifiedSellers).toLocaleString()}+` 
                    : "0+" 
              },
              { 
                label: "Satisfaction", 
                value: loadingStats 
                  ? "..." 
                  : statistics.satisfaction !== null 
                    ? `${statistics.satisfaction}%` 
                    : "0%" 
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="py-5">
                  <CardTitle className="text-2xl">{stat.value}</CardTitle>
                  <CardDescription>{stat.label}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Browse categories</h2>
              <p className="text-muted-foreground">Start with what you need—then explore deeper.</p>
            </div>
            <Button variant="outline" asChild className="w-fit">
              <Link to={guardedTo("/services")} className="gap-2">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Separator className="my-6" />

          {loadingCategories ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[128px] w-full rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No categories available yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {categories.slice(0, 12).map((cat) => (
                <Link key={cat.id} to={guardedTo(`/services?category=${cat.id}`)} className="group">
                  <Card className="h-full transition-colors group-hover:bg-muted/30">
                    <CardHeader className="items-center gap-3 py-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-2xl">{cat.icon ? renderIcon(cat.icon) : "•"}</span>
                      </div>
                      <div className="space-y-1 text-center">
                        <CardTitle className="text-sm">{cat.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {cat.serviceCount ?? 0} listings
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured services */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Featured services</h2>
              <p className="text-muted-foreground">Fresh listings from the community.</p>
            </div>
            <Button asChild className="w-fit">
              <Link to={guardedTo("/services")} className="gap-2">
                Explore <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Separator className="my-6" />

          {loadingFeatured ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[180px] w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredServices.map((svc) => (
                <Card key={svc.id} className="overflow-hidden">
                  <CardHeader className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-1 text-base">{svc.title}</CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {svc.balance} USD
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{svc.adText}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <StarRating rating={Number(svc.averageRating ?? svc.rating ?? 0)} />
                        <span className="ml-0.5">{Number(svc.averageRating ?? svc.rating ?? 0).toFixed(1)}</span>
                      </span>
                      {svc.category?.title ? (
                        <Badge variant="outline">{svc.category.title}</Badge>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => guardedNavigate(`/services/${svc.id}`)}
                    >
                      View details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((b) => (
              <Card key={b.title}>
                <CardHeader className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{b.title}</CardTitle>
                  <CardDescription>{b.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <Card className="overflow-hidden">
            <CardContent className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-10">
              <div className="space-y-3">
                <Badge variant="secondary" className="w-fit">Start today</Badge>
                <div className="space-y-2">
                  <div className="text-2xl font-bold tracking-tight">Create a profile, list a service, and grow.</div>
                  <div className="text-muted-foreground">
                    Get the social discovery of a feed with the structure of a marketplace.
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="gap-2">
                    <Link to="/signup">
                      Create account <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/signin">Sign in</Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="text-sm font-semibold">Quick actions</div>
                <div className="mt-3 space-y-2">
                  <Button variant="secondary" className="w-full justify-between" asChild>
                    <Link to={guardedTo("/services")}>
                      Browse services <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="secondary" className="w-full justify-between" asChild>
                    <Link to={guardedTo("/feed")}>
                      Open community feed <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="secondary" className="w-full justify-between" asChild>
                    <Link to={guardedTo("/referral")}>
                      Referral program <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

export default Home
