import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { paymentApi, Transaction } from "../services/api"
import { showToast } from "../utils/toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Copy, ExternalLink, RefreshCcw, Wallet } from "lucide-react"

type WithdrawStatusResponse = {
  status: string
  transactionHash?: string
  confirmedAt?: string
}

function inferNetworkFromAddress(walletAddress?: string) {
  if (!walletAddress) return { network: "Unknown", explorer: null as null | { name: string; url: string } }
  if (walletAddress.startsWith("0x")) {
    return {
      network: "Polygon",
      explorer: { name: "PolygonScan", url: `https://polygonscan.com/address/${walletAddress}` },
    }
  }
  if (walletAddress.startsWith("T")) {
    return {
      network: "TRC20",
      explorer: { name: "TronScan", url: `https://tronscan.org/#/address/${walletAddress}` },
    }
  }
  return { network: "Unknown", explorer: null as null | { name: string; url: string } }
}

export default function WithdrawDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { transactionId } = useParams<{ transactionId: string }>()
  const stateTx = (location.state as any)?.transaction as Transaction | undefined

  const [status, setStatus] = useState<WithdrawStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!transactionId) {
      navigate("/transactions")
      return
    }
    const run = async () => {
      try {
        setLoading(true)
        const data = await paymentApi.getWithdrawStatus(transactionId)
        setStatus(data)
      } catch (err: any) {
        const msg = err.response?.data?.message || "Failed to load withdrawal status"
        showToast.error(msg)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [transactionId, navigate])

  const displayTx = useMemo(() => {
    return stateTx
  }, [stateTx])

  const networkInfo = useMemo(() => inferNetworkFromAddress(displayTx?.walletAddress), [displayTx?.walletAddress])

  const statusBadge = useMemo(() => {
    const s = (status?.status || displayTx?.status || "").toLowerCase()
    if (s === "success") return { label: "SUCCESS", variant: "secondary" as const }
    if (s === "pending") return { label: "PENDING", variant: "outline" as const }
    if (s === "failed") return { label: "FAILED", variant: "destructive" as const }
    if (s === "cancelled") return { label: "CANCELLED", variant: "outline" as const }
    if (s) return { label: s.toUpperCase(), variant: "outline" as const }
    return { label: "UNKNOWN", variant: "outline" as const }
  }, [status?.status, displayTx?.status])

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast.success(`${label} copied`)
    } catch {
      showToast.error("Failed to copy")
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Withdrawal</div>
          <div className="text-sm text-muted-foreground">Track the status of your withdrawal request.</div>
        </div>
        <Button asChild variant="outline">
          <Link to="/transactions">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Details
            </CardTitle>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <CardDescription>Withdrawal requests are processed by admin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {displayTx ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div className="pt-1 text-xl font-bold">{Number(displayTx.amount).toFixed(2)} USD</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs text-muted-foreground">Network</div>
                  <div className="pt-1 text-xl font-bold">{networkInfo.network}</div>
                </div>
              </div>

              {displayTx.walletAddress ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Destination address</div>
                  <div className="flex items-center gap-2">
                    <Input value={displayTx.walletAddress} readOnly className="font-mono text-xs sm:text-sm" />
                    <Button type="button" variant="secondary" className="gap-2" onClick={() => copy(displayTx.walletAddress!, "Address")}>
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                    {networkInfo.explorer ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => window.open(networkInfo.explorer!.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        {networkInfo.explorer.name}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Opened directly without transaction context. You can still see the live status below.
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-semibold">Status</div>
            <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Current</div>
                <div className="text-sm font-semibold">{(status?.status || displayTx?.status || "unknown").toUpperCase()}</div>
              </div>

              {status?.confirmedAt ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">Confirmed</div>
                  <div className="text-sm font-medium">{new Date(status.confirmedAt).toLocaleString()}</div>
                </div>
              ) : null}

              {status?.transactionHash ? (
                <div className="space-y-2 pt-2">
                  <div className="text-sm font-medium">Transaction hash</div>
                  <div className="flex items-center gap-2">
                    <Input value={status.transactionHash} readOnly className="font-mono text-xs sm:text-sm" />
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      onClick={() => copy(status.transactionHash!, "Hash")}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        // Best-effort explorer link (uses network inference from address)
                        if (networkInfo.network === "Polygon") {
                          window.open(`https://polygonscan.com/tx/${status.transactionHash}`, "_blank")
                        } else {
                          window.open(`https://tronscan.org/#/transaction/${status.transactionHash}`, "_blank")
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Explorer
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" className="gap-2" onClick={async () => {
              if (!transactionId) return
              try {
                setLoading(true)
                const data = await paymentApi.getWithdrawStatus(transactionId)
                setStatus(data)
              } catch {
                showToast.error("Failed to refresh status")
              } finally {
                setLoading(false)
              }
            }}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


