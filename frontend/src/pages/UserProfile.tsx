import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { authApi } from "../services/api"
import { showToast } from "../utils/toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Briefcase, Calendar, Coins, Mail, Star } from "lucide-react"

interface UserProfileData {
  id: string
  userName?: string
  firstName?: string
  lastName?: string
  middleName?: string
  bio?: string
  avatar?: string
  emailVerified: boolean
  phoneVerified: boolean
  status: string
  createdAt: string
  totalEarned: number
  services: Array<{
    id: string
    title: string
    status: string
    balance: number
    paymentDuration: string
    rating: number
    createdAt: string
  }>
}

function UserProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchUserProfile()
    }
  }, [userId])

  const fetchUserProfile = async () => {
    if (!userId) return

    try {
      setLoading(true)
      const data = await authApi.getUserProfile(userId)
      setProfile(data)
    } catch (error) {
      console.error("Failed to fetch user profile:", error)
      showToast.error("Failed to load user profile")
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPaymentDuration = (duration: string) => {
    const durationMap: Record<string, string> = {
      hourly: 'Hourly',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      each_time: 'Per Service',
    }
    return durationMap[duration] || duration
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 py-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-4xl py-10">
        <Card>
          <CardContent className="py-10 text-center">
            <div className="text-sm text-muted-foreground">User profile not found.</div>
            <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = profile.firstName || profile.lastName
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
    : ""

  const displayName = fullName || profile.userName || "User"
  const avatarLabel = fullName || profile.userName || "U"
  const avatarFallback = avatarLabel[0].toUpperCase()

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-4">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-4 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-background" />
        <CardContent className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
              <AvatarImage src={profile.avatar || ""} alt={displayName} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="truncate text-xl font-bold">{displayName}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {profile.userName && <span className="truncate">@{profile.userName}</span>}
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Registered: {formatDate(profile.createdAt)}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge variant={profile.emailVerified ? "secondary" : "outline"} className="gap-1">
                  <Mail className="h-3 w-3" />
                  {profile.emailVerified ? "Email verified" : "Email not verified"}
                </Badge>
                {profile.status && <Badge variant="outline">{profile.status}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Total Earned
            </CardTitle>
            <CardDescription>Total money earned from providing services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(profile.totalEarned)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Services Created
            </CardTitle>
            <CardDescription>Total number of services created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {profile.services.length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {profile.services.filter((s) => s.status === "active").length} active
            </div>
          </CardContent>
        </Card>
      </div>

      {profile.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {profile.bio}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Services Created
          </CardTitle>
          <CardDescription>All services created by this user</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.services.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
              <Briefcase className="h-5 w-5" />
              No services created yet.
            </div>
          ) : (
            <div className="space-y-4">
              {profile.services.map((service) => {
                const isBlocked = service.status === "blocked"
                const serviceContent = (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={`font-semibold truncate ${!isBlocked ? "hover:text-primary transition-colors" : ""}`}>
                          {service.title}
                        </h3>
                        <Badge
                          variant={service.status === "active" ? "default" : service.status === "blocked" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {service.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5" />
                          {formatCurrency(service.balance)} {formatPaymentDuration(service.paymentDuration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(service.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {service.rating > 0 ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-base">{service.rating.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= Math.round(service.rating)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">No rating</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className="h-3 w-3 text-muted-foreground"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )

                return isBlocked ? (
                  <div
                    key={service.id}
                    className="block border rounded-lg p-4 opacity-60 cursor-not-allowed"
                    title="This service is blocked and cannot be accessed"
                    onClick={(e) => {
                      e.preventDefault()
                      showToast.error("This service is blocked and cannot be accessed")
                    }}
                  >
                    {serviceContent}
                  </div>
                ) : (
                  <Link
                    key={service.id}
                    to={`/services/${service.id}`}
                    className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {serviceContent}
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default UserProfile

