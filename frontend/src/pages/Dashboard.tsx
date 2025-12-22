import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bell,
  LifeBuoy,
  Lock,
  PlusCircle,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import { useAppSelector } from "@/store/hooks"
import {
  helpApi,
  HelpRequest,
  notificationApi,
  paymentApi,
  referralApi,
  serviceApi,
  authApi,
  Service,
  Transaction,
} from "@/services/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

function formatMoney(amount?: number) {
  if (amount === undefined || amount === null) return "—"
  return `${Number(amount).toFixed(2)} USD`
}

function formatDate(d?: string) {
  if (!d) return ""
  try {
    return new Date(d).toLocaleString()
  } catch {
    return d
  }
}

function dayKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function shortDayLabel(key: string) {
  // key: YYYY-MM-DD
  try {
    const d = new Date(`${key}T00:00:00`)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return key
  }
}

export default function Dashboard() {
  const user = useAppSelector((s) => s.auth.user)

  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [myServices, setMyServices] = useState<Service[]>([])
  const [myServicesTotal, setMyServicesTotal] = useState<number | null>(null)
  const [referralStats, setReferralStats] = useState<Awaited<ReturnType<typeof referralApi.getMyStats>> | null>(null)
  const [myHelps, setMyHelps] = useState<HelpRequest[]>([])
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null)
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])

  const displayName = useMemo(() => {
    if (!user) return "User"
    return (
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.userName ||
      user.email ||
      "User"
    )
  }, [user])

  const servicesByStatus = useMemo(() => {
    const counts = { draft: 0, active: 0, blocked: 0 } as Record<"draft" | "active" | "blocked", number>
    for (const s of myServices) {
      const st = s.status as keyof typeof counts
      if (st in counts) counts[st] += 1
    }
    return [
      { status: "draft", count: counts.draft },
      { status: "active", count: counts.active },
      { status: "blocked", count: counts.blocked },
    ]
  }, [myServices])

  const transactionsChart = useMemo(() => {
    const days = 14
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - (days - 1))

    const index: Record<string, { day: string; charge: number; withdraw: number; milestone: number }> = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const k = dayKey(d)
      index[k] = { day: k, charge: 0, withdraw: 0, milestone: 0 }
    }

    for (const t of recentTransactions) {
      // Chart successful activity only to avoid noise
      if (t.status && t.status !== "success") continue
      const created = t.createdAt ? new Date(t.createdAt) : null
      if (!created || Number.isNaN(created.getTime())) continue
      const k = dayKey(created)
      if (!index[k]) continue
      const amt = Number(t.amount || 0)
      if (!Number.isFinite(amt) || amt <= 0) continue
      if (t.type === "charge") index[k].charge += amt
      else if (t.type === "withdraw") index[k].withdraw += amt
      else index[k].milestone += amt
    }

    return Object.values(index)
  }, [recentTransactions])

  const servicesChartConfig = {
    count: { label: "Services", color: "hsl(var(--chart-1))" },
  } satisfies ChartConfig

  const transactionsChartConfig = {
    charge: { label: "Charge", color: "hsl(var(--chart-1))" },
    withdraw: { label: "Withdraw", color: "hsl(var(--chart-2))" },
    milestone: { label: "Milestone", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig

  useEffect(() => {
    let mounted = true

    const run = async () => {
      setLoading(true)

      const results = await Promise.allSettled([
        paymentApi.getBalance(),
        notificationApi.getUnreadCount(),
        // Fetch enough services to produce accurate status charts (reasonable cap).
        serviceApi.getMyServices({ page: 1, limit: 200 }),
        paymentApi.getTransactions({ page: 1, limit: 200 }),
        referralApi.getMyStats(),
        helpApi.getMy(),
        authApi.twoFactor.getStatus(),
      ])

      if (!mounted) return

      const [bal, unread, mySvc, txs, refStats, helps, twofa] = results

      if (bal.status === "fulfilled") setBalance(Number(bal.value.amount))
      if (unread.status === "fulfilled") setUnreadCount(Number(unread.value.count))
      if (mySvc.status === "fulfilled") {
        setMyServices(Array.isArray(mySvc.value.data) ? mySvc.value.data : [])
        setMyServicesTotal(Number(mySvc.value.total ?? 0))
      }
      if (txs.status === "fulfilled") {
        setRecentTransactions(Array.isArray(txs.value.data) ? txs.value.data : [])
      }
      if (refStats.status === "fulfilled") setReferralStats(refStats.value)
      if (helps.status === "fulfilled") setMyHelps(Array.isArray(helps.value) ? helps.value.slice(0, 5) : [])
      if (twofa.status === "fulfilled") {
        setTwoFactorEnabled(!!twofa.value.enabled)
        setTwoFactorMethod(twofa.value.method || null)
      }

      setLoading(false)
    }

    void run()
    return () => {
      mounted = false
    }
  }, [])

  const myServicesPreview = useMemo(() => myServices.slice(0, 5), [myServices])

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{displayName}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="gap-2">
            <Link to="/services/new">
              <PlusCircle className="h-4 w-4" />
              Create service
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/notifications">
              <Bell className="h-4 w-4" />
              Notifications
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/support">
              <LifeBuoy className="h-4 w-4" />
              Get help
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Balance
            </CardDescription>
            <CardTitle className="text-2xl">
              {loading ? "…" : formatMoney(balance ?? undefined)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? "Loading your wallet…" : "Your available balance."}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Unread notifications
            </CardDescription>
            <CardTitle className="text-2xl">
              {loading ? "…" : unreadCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link className="text-primary hover:underline" to="/notifications">
              Open notifications
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Referral earnings
            </CardDescription>
            <CardTitle className="text-2xl">
              {loading ? "…" : formatMoney(referralStats?.totalEarnings)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
            <span>
              Referrals: <span className="font-medium text-foreground">{referralStats?.totalReferrals ?? 0}</span>
            </span>
            <Link className="text-primary hover:underline" to="/referral">
              View
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Security (2FA)
            </CardDescription>
            <CardTitle className="text-2xl">
              {loading || twoFactorEnabled === null ? "…" : twoFactorEnabled ? "Enabled" : "Off"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              {twoFactorEnabled ? (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> {twoFactorMethod || "2FA"}
                </Badge>
              ) : (
                <Badge variant="outline">Recommended</Badge>
              )}
            </span>
            <Link className="text-primary hover:underline" to="/settings/security">
              Manage
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Services by status</CardTitle>
            <CardDescription>How your listings are currently distributed.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : myServicesTotal === 0 ? (
              <div className="text-sm text-muted-foreground">
                No services yet.{" "}
                <Link className="text-primary hover:underline" to="/services/new">
                  Create your first service
                </Link>
                .
              </div>
            ) : (
              <ChartContainer config={servicesChartConfig} className="h-[260px] w-full">
                <BarChart data={servicesByStatus}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions (last 14 days)</CardTitle>
            <CardDescription>Successful activity grouped by day.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No recent transactions.{" "}
                <Link className="text-primary hover:underline" to="/transactions">
                  View transactions
                </Link>
                .
              </div>
            ) : (
              <ChartContainer config={transactionsChartConfig} className="h-[260px] w-full">
                <AreaChart data={transactionsChart}>
                  <defs>
                    <linearGradient id="fillCharge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-charge)" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="var(--color-charge)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillWithdraw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-withdraw)" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="var(--color-withdraw)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillMilestone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-milestone)" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="var(--color-milestone)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={shortDayLabel}
                  />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Number(v).toFixed(0)}`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => shortDayLabel(String(value))}
                      />
                    }
                  />
                  <Area type="monotone" dataKey="charge" stroke="var(--color-charge)" fill="url(#fillCharge)" stackId="a" />
                  <Area type="monotone" dataKey="milestone" stroke="var(--color-milestone)" fill="url(#fillMilestone)" stackId="a" />
                  <Area type="monotone" dataKey="withdraw" stroke="var(--color-withdraw)" fill="url(#fillWithdraw)" stackId="a" />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My services</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `You have ${myServicesTotal ?? 0} service(s).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myServicesPreview.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No services yet.{" "}
                <Link className="text-primary hover:underline" to="/services/new">
                  Create your first service
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {myServicesPreview.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={`/services/${s.id}`} className="font-medium hover:underline">
                          {s.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Updated: {formatDate(s.updatedAt)}
                        </div>
                      </div>
                      <Badge variant={s.status === "active" ? "secondary" : "outline"}>
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/my-services">View all</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Help requests</CardTitle>
            <CardDescription>Your recent support submissions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myHelps.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No help requests yet.{" "}
                <Link className="text-primary hover:underline" to="/support">
                  Send one
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-3">
                {myHelps.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-medium">{h.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Sent: {formatDate(h.createdAt)}
                        </div>
                      </div>
                      <Badge variant={h.status === "approved" ? "secondary" : "outline"}>
                        {h.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/support">Open help center</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}