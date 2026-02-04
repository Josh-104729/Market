import { useEffect, useMemo, useState } from "react"
import { ShieldAlert, CheckCircle2, XCircle } from "lucide-react"
import { adminApi, FraudConversationRow } from "../services/api"
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

function formatDate(d?: string | null) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleString()
  } catch {
    return String(d)
  }
}

function getUserName(user: any) {
  if (!user) return "—"
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim()
  return full || user.userName || user.email || user.id
}

export default function Fraud() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<FraudConversationRow[]>([])
  const [blockedFilter, setBlockedFilter] = useState<"all" | "blocked" | "unblocked">("all")
  const [pendingOnly, setPendingOnly] = useState(false)

  const filtered = useMemo(() => {
    return rows
  }, [rows])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getFraudConversations({
        blocked: blockedFilter,
        pending: pendingOnly,
      })
      setRows(data)
    } catch (error: any) {
      console.error("Failed to fetch fraud conversations:", error)
      showToast.error(error.response?.data?.message || "Failed to load fraud detections")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedFilter, pendingOnly])

  const approve = async (requestId: string) => {
    try {
      await adminApi.approveReactivationRequest(requestId)
      showToast.success("Request approved and conversation unblocked")
      await fetchRows()
    } catch (error: any) {
      console.error("Approve failed:", error)
      showToast.error(error.response?.data?.message || "Failed to approve request")
    }
  }

  const reject = async (requestId: string) => {
    try {
      await adminApi.rejectReactivationRequest(requestId)
      showToast.success("Request rejected")
      await fetchRows()
    } catch (error: any) {
      console.error("Reject failed:", error)
      showToast.error(error.response?.data?.message || "Failed to reject request")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7" />
            Fraud
          </h1>
          <p className="text-muted-foreground">
            Fraud detections grouped by conversation, with blocking and reactivation requests.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Tabs value={blockedFilter} onValueChange={(v) => setBlockedFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="blocked">Blocked</TabsTrigger>
              <TabsTrigger value="unblocked">Unblocked</TabsTrigger>
            </TabsList>
          </Tabs>

          <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
            <Checkbox checked={pendingOnly} onCheckedChange={(v) => setPendingOnly(Boolean(v))} />
            Pending only
          </label>

          <Button variant="outline" size="sm" onClick={fetchRows}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading fraud detections...</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No fraud detections found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((row) => (
            <Card
              key={row.conversation.id}
              className="bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40"
            >
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {row.conversation.service?.title || "Conversation"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Client: {getUserName(row.conversation.client)}{" "}
                        <span className="mx-2 text-muted-foreground/60">•</span>
                        Provider: {getUserName(row.conversation.provider)}
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.conversation.isBlocked ? "destructive" : "secondary"}>
                        {row.conversation.isBlocked ? "Blocked" : "Unblocked"}
                      </Badge>
                      <Badge variant="outline">{row.fraudCount} fraud(s)</Badge>
                      {row.unreviewedCount > 0 && (
                        <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                          {row.unreviewedCount} needs review
                        </Badge>
                      )}
                      <Badge variant="outline">latest: {formatDate(row.latestFraudAt)}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Tabs defaultValue="frauds" className="w-full">
                  <TabsList>
                    <TabsTrigger value="frauds">Frauds ({row.frauds.length})</TabsTrigger>
                    <TabsTrigger value="requests">Requests ({row.reactivationRequests?.length || 0})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="requests" className="mt-4">
                    {row.reactivationRequests?.length ? (
                      <div className="space-y-2">
                        {row.reactivationRequests.map((r) => (
                          <div
                            key={r.id}
                            className="rounded-lg border bg-muted/30 px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            <div className="text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-foreground">
                                  <span className="font-medium">Requester:</span> {getUserName(r.requester)}
                                </span>
                                <Badge
                                  variant={
                                    r.status === "pending"
                                      ? "secondary"
                                      : r.status === "approved"
                                        ? "default"
                                        : "outline"
                                  }
                                >
                                  {r.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                requested: {formatDate(r.createdAt)}{" "}
                                {r.decidedAt ? `• decided: ${formatDate(r.decidedAt)}` : ""}
                              </div>
                              {r.note ? <div className="text-xs text-muted-foreground mt-1">note: {r.note}</div> : null}
                            </div>

                            {r.status === "pending" ? (
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="gap-2" onClick={() => approve(r.id)}>
                                  <CheckCircle2 className="w-4 h-4" />
                                  Approve & Unblock
                                </Button>
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => reject(r.id)}>
                                  <XCircle className="w-4 h-4" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {r.decidedBy ? `by ${getUserName(r.decidedBy)}` : ""}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No reactivation requests.</div>
                    )}
                  </TabsContent>

                  <TabsContent value="frauds" className="mt-4">
                    <Separator className="mb-3" />
                    <ScrollArea className="h-[360px] pr-3">
                      <div className="space-y-2">
                        {row.frauds.map((f) => (
                          <div key={f.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="destructive">{f.category || "uncategorized"}</Badge>
                              <Badge variant="outline">{f.confidence || "—"}</Badge>
                              <Badge variant="outline">{formatDate(f.createdAt)}</Badge>
                              <Badge variant="outline">sender: {getUserName(f.sender)}</Badge>
                            </div>
                            {f.reason ? <div className="text-sm text-foreground mt-2">{f.reason}</div> : null}
                            <div className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words">{f.messageText}</div>
                            {f.signals?.length ? (
                              <div className="text-xs text-muted-foreground mt-2">
                                signals: {f.signals.slice(0, 6).join(", ")}{f.signals.length > 6 ? "…" : ""}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


