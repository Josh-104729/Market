import { useEffect, useMemo, useState } from "react"
import { adminApi, TempWallet } from "../services/api"
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, RefreshCcw, Send, Wallet as WalletIcon } from "lucide-react"

function TempWallets() {
  const [wallets, setWallets] = useState<TempWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [networkFilter, setNetworkFilter] = useState<"ALL" | "TRON" | "POLYGON">("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL")

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<TempWallet | null>(null)

  useEffect(() => {
    loadWallets()
  }, [])

  const loadWallets = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getTempWallets()
      setWallets(data)
      setError(null)
    } catch (err: any) {
      console.error('Failed to load temp wallets:', err)
      setError(err.response?.data?.message || 'Failed to load temp wallets')
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async (walletId: string) => {
    const wallet = wallets.find((w) => w.id === walletId) || null
    if (!wallet) return
    setSelectedWallet(wallet)
    setConfirmOpen(true)
  }

  const confirmTransfer = async () => {
    if (!selectedWallet) return
    const walletId = selectedWallet.id

    try {
      setTransferring(walletId)
      setError(null)
      const result = await adminApi.transferFromTempWallet(walletId)

      // Show success toast with transaction details
      const currency = selectedWallet.network === "POLYGON" ? "USDC" : "USDT"
      const message = (
        <div>
          <div className="font-semibold">Transfer successful!</div>
          {result.amountTransferred > 0 && (
            <div className="text-sm mt-1">
              Amount: {Number(result.amountTransferred || 0).toFixed(2)} {currency}
            </div>
          )}
          {result.trxTxHash && (
            <div className="text-xs mt-1 break-all">
              TRX TX: {result.trxTxHash}
            </div>
          )}
          {result.usdtTxHash && (
            <div className="text-xs mt-1 break-all">
              USDT TX: {result.usdtTxHash}
            </div>
          )}
          {result.maticTxHash && (
            <div className="text-xs mt-1 break-all">
              MATIC TX: {result.maticTxHash}
            </div>
          )}
          {result.usdcTxHash && (
            <div className="text-xs mt-1 break-all">
              USDC TX: {result.usdcTxHash}
            </div>
          )}
        </div>
      )
      showToast.success(message, { autoClose: 6000 })

      // Wait a moment for blockchain to update, then reload wallets to update balances
      await new Promise(resolve => setTimeout(resolve, 2000))
      await loadWallets()
      setConfirmOpen(false)
      setSelectedWallet(null)
    } catch (err: any) {
      console.error('Transfer failed:', err)
      let errorMessage = err.response?.data?.message || 'Failed to transfer funds'

      setError(errorMessage)
      showToast.error(
        <div>
          <div className="font-semibold">Transfer Failed</div>
          <div className="text-sm mt-1 whitespace-pre-line">{errorMessage}</div>
        </div>,
        { autoClose: 8000 }
      )
    } finally {
      setTransferring(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredWallets = useMemo(() => {
    const q = search.trim().toLowerCase()
    return wallets.filter((w) => {
      if (networkFilter !== "ALL" && w.network !== networkFilter) return false
      if (statusFilter !== "ALL" && String(w.status).toUpperCase() !== statusFilter) return false

      if (!q) return true
      const userText = w.user ? `${w.user.email} ${w.user.userName || ""} ${w.user.firstName || ""} ${w.user.lastName || ""}` : ""
      return (
        String(w.address).toLowerCase().includes(q) ||
        String(w.id).toLowerCase().includes(q) ||
        String(w.userId).toLowerCase().includes(q) ||
        userText.toLowerCase().includes(q)
      )
    })
  }, [networkFilter, search, statusFilter, wallets])

  const totals = useMemo(() => {
    const tron = wallets.filter((w) => w.network === "TRON")
    const polygon = wallets.filter((w) => w.network === "POLYGON")
    const totalUSDT = tron.reduce((sum, w) => sum + Number((w as any).usdtBalance || 0), 0)
    const totalUSDC = polygon.reduce((sum, w) => sum + Number((w as any).usdcBalance || 0), 0)
    const withBalance = wallets.filter((w) => {
      const bal = w.network === "POLYGON" ? Number((w as any).usdcBalance || 0) : Number((w as any).usdtBalance || 0)
      return bal > 0
    }).length
    return { totalUSDT, totalUSDC, withBalance }
  }, [wallets])

  const selectedAmount = useMemo(() => {
    if (!selectedWallet) return 0
    return selectedWallet.network === "POLYGON"
      ? Number((selectedWallet as any).usdcBalance || 0)
      : Number((selectedWallet as any).usdtBalance || 0)
  }, [selectedWallet])

  const selectedCurrency = selectedWallet?.network === "POLYGON" ? "USDC" : "USDT"

  const statusBadge = (status: string) => {
    const s = String(status || "").toUpperCase()
    if (s === "ACTIVE") return <Badge variant="secondary">ACTIVE</Badge>
    if (s === "COMPLETED") return <Badge>COMPLETED</Badge>
    return <Badge variant="outline">{s || "UNKNOWN"}</Badge>
  }

  const networkLabel = (network?: string) => {
    if (network === "TRON") return { title: "USDT TRC20", sub: "Normal Wallet" }
    if (network === "POLYGON") return { title: "USDC Polygon", sub: "Normal Wallet" }
    return { title: "Unknown", sub: "—" }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Temp wallets</h1>
          <p className="text-sm text-muted-foreground">
            Monitor balances and manually transfer funds to the master wallet.
          </p>
        </div>
        <Button onClick={() => void loadWallets()} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total wallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.length}</div>
            <div className="text-xs text-muted-foreground">With balance: {totals.withBalance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total USDT (TRON)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalUSDT.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Real-time token balance sum</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total USDC (Polygon)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalUSDC.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Real-time token balance sum</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wallet list</CardTitle>
          <CardDescription>Search, filter, and transfer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-1">
              <Label>Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Address, user email, wallet id…"
              />
            </div>

            <div className="space-y-2">
              <Label>Network</Label>
              <Select value={networkFilter} onValueChange={(v) => setNetworkFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All networks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="TRON">TRON (USDT)</SelectItem>
                  <SelectItem value="POLYGON">POLYGON (USDC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No temp wallets found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Total received</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWallets.map((w) => {
                  const net = networkLabel(w.network)
                  const balance =
                    w.network === "POLYGON" ? Number((w as any).usdcBalance || 0) : Number((w as any).usdtBalance || 0)
                  const currency = w.network === "POLYGON" ? "USDC" : "USDT"
                  const canTransfer = balance > 0 && transferring !== w.id
                  const isBusy = transferring === w.id
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="min-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{w.address}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(w.address)}
                            title="Copy address"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-[11px] text-muted-foreground">ID: {w.id}</div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">{net.title}</div>
                        <div className="text-xs text-muted-foreground">{net.sub}</div>
                      </TableCell>

                      <TableCell className="min-w-[200px]">
                        {w.user ? (
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {`${w.user.firstName || ""} ${w.user.lastName || ""}`.trim() || w.user.userName || "User"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{w.user.email}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Unknown user</div>
                        )}
                      </TableCell>

                      <TableCell>{statusBadge(w.status)}</TableCell>

                      <TableCell className="text-right">
                        <div className={`font-semibold ${balance > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {balance.toFixed(2)} {currency}
                        </div>
                        <div className="text-xs text-muted-foreground">Real-time</div>
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="font-medium">{Number((w as any).totalReceived || 0).toFixed(2)}</span>
                        <span className="text-muted-foreground"> {currency}</span>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {w.lastCheckedAt ? formatDate(w.lastCheckedAt) : "—"}
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">{formatDate(w.createdAt)}</TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="gap-2"
                          variant={balance > 0 ? "default" : "outline"}
                          disabled={!canTransfer && !isBusy}
                          onClick={() => handleTransfer(w.id)}
                        >
                          <Send className="h-4 w-4" />
                          {isBusy ? "Transferring…" : "Transfer"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <WalletIcon className="h-4 w-4 text-muted-foreground" /> How transfers work
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Transfers are manual: once a charge is detected, the user’s balance is credited, and admins transfer funds from temp
            wallets to the master wallet when ready.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            If the wallet lacks gas (TRX/MATIC), the backend may top it up before transferring tokens. Use “Refresh” to update
            balances.
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => {
        setConfirmOpen(v)
        if (!v) setSelectedWallet(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transfer</DialogTitle>
            <DialogDescription>
              This will transfer available funds from the selected temp wallet to the master wallet.
            </DialogDescription>
          </DialogHeader>

          {selectedWallet ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Wallet address</div>
                <div className="font-mono text-xs break-all">{selectedWallet.address}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Amount to transfer</div>
                <div className="text-sm font-semibold">
                  {selectedAmount.toFixed(2)} {selectedCurrency}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmTransfer()}
              disabled={!selectedWallet || selectedAmount <= 0 || transferring === selectedWallet?.id}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {selectedWallet && transferring === selectedWallet.id ? "Transferring…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TempWallets

