import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { adminApi, HelpRequest } from "../services/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { showToast } from "../utils/toast"
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react"

function formatDate(d?: string) {
  if (!d) return ""
  try {
    return new Date(d).toLocaleString()
  } catch {
    return d
  }
}

function userLabel(h: HelpRequest) {
  const u = h.user
  if (!u) return h.userId
  const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.userName || u.email
  return name
}

export default function Helps() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<HelpRequest[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const pendingCount = useMemo(() => items.filter((x) => x.status === "pending").length, [items])

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminApi.getHelps()
      setItems(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error(e)
      showToast.error(e?.response?.data?.message || "Failed to load help requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const approve = async (id: string) => {
    if (approvingId) return
    setApprovingId(id)
    try {
      await adminApi.approveHelp(id)
      showToast.success("Approved")
      await load()
    } catch (e: any) {
      console.error(e)
      showToast.error(e?.response?.data?.message || "Failed to approve")
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help requests</h1>
        <p className="text-sm text-muted-foreground">
          Review user submissions and approve them. Pending: {pendingCount}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No help requests.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="min-w-[180px]">
                      <div className="font-medium">{userLabel(h)}</div>
                      <div className="text-xs text-muted-foreground">{h.user?.email || h.userId}</div>
                    </TableCell>
                    <TableCell className="min-w-[240px]">
                      <Link to={`/helps/${h.id}`} className="font-medium text-primary hover:underline">
                        {h.title}
                      </Link>
                      <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                        {h.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      {h.status === "approved" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      {h.approvedAt ? (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {formatDate(h.approvedAt)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(h.createdAt)}</TableCell>
                    <TableCell>
                      {h.imageUrl ? (
                        <a
                          href={h.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          View <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={h.status === "approved" || approvingId === h.id}
                        onClick={() => void approve(h.id)}
                        className="gap-2"
                      >
                        {approvingId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


