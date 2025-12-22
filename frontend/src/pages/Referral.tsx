import { useEffect, useMemo, useState } from "react"
import { referralApi, ReferralStats, ReferralListItem, RewardListItem } from "../services/api"
import ReferralCode from "../components/ReferralCode"
import { showToast } from "../utils/toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Gift, Users } from "lucide-react"

function Referral() {
  const [loading, setLoading] = useState(true)
  const [loadingReferrals, setLoadingReferrals] = useState(false)
  const [loadingRewards, setLoadingRewards] = useState(false)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [referrals, setReferrals] = useState<ReferralListItem[]>([])
  const [rewards, setRewards] = useState<RewardListItem[]>([])
  const [activeTab, setActiveTab] = useState<"referrals" | "rewards">("referrals")
  const [referralsPage, setReferralsPage] = useState(1)
  const [rewardsPage, setRewardsPage] = useState(1)
  const [referralsTotalPages, setReferralsTotalPages] = useState(1)
  const [rewardsTotalPages, setRewardsTotalPages] = useState(1)
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Skip on initial mount - loadData already loads referrals
    if (initialLoad) {
      setInitialLoad(false)
      return
    }

    // Load data when tab or page changes
    if (activeTab === 'referrals') {
      loadReferrals()
    } else {
      loadRewards()
    }
  }, [activeTab, referralsPage, rewardsPage])

  const loadData = async () => {
    try {
      const [statsData, referralsData] = await Promise.all([
        referralApi.getMyStats(),
        referralApi.getMyReferrals({ page: 1, limit: 10 }),
      ])
      setStats(statsData)
      setReferrals(referralsData.referrals)
      setReferralsTotalPages(referralsData.totalPages)
    } catch (error: any) {
      showToast.error(error.response?.data?.message || "Failed to load referral data")
    } finally {
      setLoading(false)
    }
  }

  const loadReferrals = async () => {
    setLoadingReferrals(true)
    try {
      const data = await referralApi.getMyReferrals({ page: referralsPage, limit: 10 })
      setReferrals(data.referrals || [])
      setReferralsTotalPages(data.totalPages || 1)
    } catch (error: any) {
      console.error("Failed to load referrals:", error)
      showToast.error(error.response?.data?.message || "Failed to load referrals")
      setReferrals([])
    } finally {
      setLoadingReferrals(false)
    }
  }

  const loadRewards = async () => {
    setLoadingRewards(true)
    try {
      const data = await referralApi.getRewards({ page: rewardsPage, limit: 10 })
      setRewards(data.rewards || [])
      setRewardsTotalPages(data.totalPages || 1)
    } catch (error: any) {
      console.error("Failed to load rewards:", error)
      showToast.error(error.response?.data?.message || "Failed to load rewards")
      setRewards([])
    } finally {
      setLoadingRewards(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase()
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      pending: { label: "Pending", variant: "outline" },
      active: { label: "Active", variant: "secondary" },
      completed: { label: "Completed", variant: "default" },
      expired: { label: "Expired", variant: "destructive" },
    }
    const config = map[s] || map.pending
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getRewardTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      signup_bonus: "Signup Bonus",
      first_purchase: "First Purchase",
      milestone: "Milestone",
      custom: "Custom",
    }
    return labels[type] || type
  }

  const referralsPages = useMemo(() => {
    const start = Math.max(1, referralsPage - 1)
    const end = Math.min(referralsTotalPages, referralsPage + 1)
    const pages: number[] = []
    for (let p = start; p <= end; p++) pages.push(p)
    return pages
  }, [referralsPage, referralsTotalPages])

  const rewardsPages = useMemo(() => {
    const start = Math.max(1, rewardsPage - 1)
    const end = Math.min(rewardsTotalPages, rewardsPage + 1)
    const pages: number[] = []
    for (let p = start; p <= end; p++) pages.push(p)
    return pages
  }, [rewardsPage, rewardsTotalPages])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Referral</div>
          <div className="text-sm text-muted-foreground">Invite friends and track your rewards.</div>
        </div>
      </div>

      {stats ? (
        <>
          <ReferralCode code={stats.referralCode} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total referrals</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalReferrals}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.activeReferrals}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.completedReferrals}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total earnings</CardTitle>
                  <Gift className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalEarnings.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">USD</div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-6">
            <div className="text-sm text-muted-foreground">Loading referral stats…</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="referrals">My referrals</TabsTrigger>
                <TabsTrigger value="rewards">Reward history</TabsTrigger>
              </TabsList>
            </Tabs>
            {stats ? (
              <div className="text-sm text-muted-foreground">
                {activeTab === "referrals" ? `${stats.totalReferrals} total` : ""}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTab === "referrals" ? (
            <div className="space-y-3">
              {loadingReferrals ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : referrals.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No referrals yet. Start sharing your code!
                </div>
              ) : (
                <div className="space-y-3">
                  {referrals.map((referral) => {
                    const name =
                      (referral.referredUser.firstName && referral.referredUser.lastName)
                        ? `${referral.referredUser.firstName} ${referral.referredUser.lastName}`
                        : referral.referredUser.userName || referral.referredUser.email
                    const fallback =
                      (referral.referredUser.firstName?.[0] ||
                        referral.referredUser.userName?.[0] ||
                        "U").toUpperCase()
                    return (
                      <div key={referral.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={referral.referredUser.avatar || ""} alt={name || "User"} />
                            <AvatarFallback>{fallback}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(referral.referredAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(referral.status)}
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Earnings</div>
                            <div className="text-sm font-semibold text-foreground">
                              {referral.earnings.toFixed(2)} USD
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {referralsTotalPages > 1 ? (
                <div className="flex justify-center pt-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setReferralsPage((p) => Math.max(1, p - 1))
                          }}
                          className={referralsPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {referralsPages.map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === referralsPage}
                            onClick={(e) => {
                              e.preventDefault()
                              setReferralsPage(p)
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setReferralsPage((p) => Math.min(referralsTotalPages, p + 1))
                          }}
                          className={referralsPage === referralsTotalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {loadingRewards ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : rewards.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No rewards yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward) => {
                    const name =
                      (reward.referredUser.firstName && reward.referredUser.lastName)
                        ? `${reward.referredUser.firstName} ${reward.referredUser.lastName}`
                        : reward.referredUser.userName || "User"
                    return (
                      <div key={reward.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{getRewardTypeLabel(reward.rewardType)}</div>
                            <div className="text-xs text-muted-foreground">{name}</div>
                            {reward.description ? (
                              <div className="pt-1 text-xs text-muted-foreground">{reward.description}</div>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">
                              +{reward.amount.toFixed(2)} {reward.currency}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {reward.processedAt ? new Date(reward.processedAt).toLocaleDateString() : "Pending"}
                            </div>
                            {reward.status === "processed" ? (
                              <div className="pt-1">
                                <Badge variant="secondary">Processed</Badge>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {rewardsTotalPages > 1 ? (
                <div className="flex justify-center pt-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setRewardsPage((p) => Math.max(1, p - 1))
                          }}
                          className={rewardsPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {rewardsPages.map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === rewardsPage}
                            onClick={(e) => {
                              e.preventDefault()
                              setRewardsPage(p)
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setRewardsPage((p) => Math.min(rewardsTotalPages, p + 1))
                          }}
                          className={rewardsPage === rewardsTotalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Referral

