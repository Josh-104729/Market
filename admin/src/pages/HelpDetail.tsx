import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { adminApi, HelpRequest } from "../services/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { showToast } from "../utils/toast"
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2 } from "lucide-react"

function formatDate(d?: string) {
  if (!d) return ""
  try {
    return new Date(d).toLocaleString()
  } catch {
    return d
  }
}

export default function HelpDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [item, setItem] = useState<HelpRequest | null>(null)

  const userName = useMemo(() => {
    const u = item?.user
    if (!u) return item?.userId || ""
    return `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.userName || u.email
  }, [item])

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await adminApi.getHelp(id)
      setItem(data)
    } catch (e: any) {
      console.error(e)
      showToast.error(e?.response?.data?.message || "Failed to load help request")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const approve = async () => {
    if (!id || approving) return
    setApproving(true)
    try {
      const updated = await adminApi.approveHelp(id)
      setItem(updated)
      showToast.success("Approved")
    } catch (e: any) {
      console.error(e)
      showToast.error(e?.response?.data?.message || "Failed to approve")
    } finally {
      setApproving(false)
    }
  }

  if (!id) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">Missing help id.</div>
        <Button variant="outline" onClick={() => navigate("/helps")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/helps">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Help detail</h1>
            <p className="text-sm text-muted-foreground">ID: {id}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : !item ? (
        <div className="text-sm text-muted-foreground">Not found.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <CardDescription>
                  From <span className="font-medium text-foreground">{userName}</span>{" "}
                  <span className="text-muted-foreground">({item.user?.email || item.userId})</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</div>

                {item.imageUrl ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Attached image</div>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <img src={item.imageUrl} alt="Help attachment" className="max-h-[420px] w-full object-contain bg-muted/30" />
                    </div>
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Open original <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  {item.status === "approved" ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  <Button
                    size="sm"
                    disabled={item.status === "approved" || approving}
                    onClick={() => void approve()}
                    className="gap-2"
                  >
                    {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Approve
                  </Button>
                </div>

                <Separator />

                <div className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{formatDate(item.updatedAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Approved at</span>
                    <span>{item.approvedAt ? formatDate(item.approvedAt) : "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}


