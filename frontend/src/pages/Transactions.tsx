import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { paymentApi, Transaction } from "../services/api"
import { showToast } from "../utils/toast"
import { useAppSelector } from "../store/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ArrowDownLeft, ArrowUpRight, Copy, Loader2, RefreshCcw } from "lucide-react"

function Transactions() {
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterType, setFilterType] = useState<"all" | Transaction["type"]>("all")
  const [filterStatus, setFilterStatus] = useState<"all" | Transaction["status"]>("all")
  const limit = 10

  useEffect(() => {
    loadTransactions()
  }, [page])

  useEffect(() => {
    setPage(1)
  }, [filterType, filterStatus])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const response = await paymentApi.getTransactions({ page, limit })
      setTransactions(response.data)
      setTotalPages(response.totalPages)
      setTotal(response.total)
    } catch (error) {
      console.error('Failed to load transactions:', error)
      showToast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'charge':
        return 'Charge'
      case 'withdraw':
        return 'Withdraw'
      case 'milestone_payment':
        return 'Milestone Payment'
      default:
        return type
    }
  }

  const getTransactionRole = (transaction: Transaction): { role: string; otherParty?: string } => {
    if (!user) return { role: 'User' }
    
    // For charge and withdraw, the user is the client (their own account)
    if (transaction.type === 'charge' || transaction.type === 'withdraw') {
      if (transaction.clientId === user.id) {
        return { role: 'User' }
      }
    }
    
    // For milestone payments
    if (transaction.type === 'milestone_payment') {
      if (transaction.clientId === user.id) {
        return {
          role: 'Client',
          otherParty: transaction.provider
            ? `${transaction.provider.firstName || ''} ${transaction.provider.lastName || ''}`.trim() || transaction.provider.userName || 'Provider'
            : 'Provider',
        }
      } else if (transaction.providerId === user.id) {
        return {
          role: 'Provider',
          otherParty: transaction.client
            ? `${transaction.client.firstName || ''} ${transaction.client.lastName || ''}`.trim() || transaction.client.userName || 'Client'
            : 'Client',
        }
      }
    }
    
    return { role: 'User' }
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

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const typeMatch = filterType === "all" || transaction.type === filterType
      const statusMatch = filterStatus === "all" || transaction.status === filterStatus
      return typeMatch && statusMatch
    })
  }, [transactions, filterType, filterStatus])

  // Calculate summary
  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.status === "success") {
          if (transaction.type === "charge" || transaction.type === "milestone_payment") {
            acc.totalIn += Number(transaction.amount)
          } else if (transaction.type === "withdraw") {
            acc.totalOut += Number(transaction.amount)
          }
        }
        return acc
      },
      { totalIn: 0, totalOut: 0 },
    )
  }, [transactions])

  const pageItems = useMemo(() => {
    // Simple pagination window with ellipses
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const items: (number | "…")[] = [1]
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    if (start > 2) items.push("…")
    for (let p = start; p <= end; p++) items.push(p)
    if (end < totalPages - 1) items.push("…")
    items.push(totalPages)
    return items
  }, [page, totalPages])

  const statusVariant = (status: Transaction["status"]) => {
    switch (status) {
      case "success":
        return "secondary" as const
      case "pending":
        return "outline" as const
      case "failed":
        return "destructive" as const
      case "cancelled":
        return "outline" as const
      case "draft":
        return "outline" as const
      case "withdraw":
        return "outline" as const
      default:
        return "outline" as const
    }
  }

  const getSignedAmount = (transaction: Transaction) => {
    if (!user) return { sign: "", isPositive: true }
    if (transaction.type === "charge") return { sign: "+", isPositive: true }
    if (transaction.type === "withdraw") return { sign: "-", isPositive: false }
    if (transaction.type === "milestone_payment") {
      // provider receives (+), client pays (-)
      const isProvider = transaction.providerId === user.id
      return { sign: isProvider ? "+" : "-", isPositive: isProvider }
    }
    return { sign: "", isPositive: true }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Transactions</div>
          <div className="text-sm text-muted-foreground">View your payment and milestone history.</div>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={loadTransactions} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {transactions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total in</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-bold">+{summary.totalIn.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">USD</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total out</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-bold">-{summary.totalOut.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">USD</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm font-medium">Type</div>
          <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="charge">Charge</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              <TabsTrigger value="milestone_payment">Milestone</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="w-full sm:w-64 space-y-2">
          <div className="text-sm font-medium">Status</div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="withdraw">Withdraw</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">History</CardTitle>
              <CardDescription>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </CardDescription>
            </div>
            {(filterType !== "all" || filterStatus !== "all") ? (
              <Button type="button" variant="ghost" onClick={() => { setFilterType("all"); setFilterStatus("all") }}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-sm text-muted-foreground">No transactions found.</div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-sm text-muted-foreground">No transactions match your filters.</div>
              <div className="pt-4">
                <Button type="button" variant="outline" onClick={() => { setFilterType("all"); setFilterStatus("all") }}>
                  Reset filters
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Hash / Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => {
                      const { role, otherParty } = getTransactionRole(transaction)
                      const isMilestonePayment = transaction.type === "milestone_payment"
                      const { sign, isPositive } = getSignedAmount(transaction)

                      const canOpenDetails =
                        (transaction.type === "charge" && !!transaction.walletAddress) ||
                        transaction.type === "withdraw"

                      const openDetails = () => {
                        if (transaction.type === "charge" && transaction.walletAddress) {
                          navigate(`/charge/${transaction.walletAddress}`)
                          return
                        }
                        if (transaction.type === "withdraw") {
                          navigate(`/withdraw/${transaction.id}`, { state: { transaction } })
                          return
                        }
                      }
                      return (
                        <TableRow
                          key={transaction.id}
                          className={canOpenDetails ? "cursor-pointer hover:bg-muted/30" : undefined}
                          onClick={canOpenDetails ? openDetails : undefined}
                        >
                          <TableCell className="font-medium">{getTypeLabel(transaction.type)}</TableCell>
                          <TableCell>
                            {isMilestonePayment ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-semibold">{role}</div>
                                {otherParty ? (
                                  <div className="text-xs text-muted-foreground">with {otherParty}</div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className={["inline-flex items-center gap-2 font-semibold", isPositive ? "text-foreground" : "text-foreground"].join(" ")}>
                              {isPositive ? <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 text-rose-600" />}
                              <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                                {sign}{Number(transaction.amount).toFixed(2)} USD
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(transaction.status)}>
                              {transaction.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(transaction.createdAt)}</TableCell>
                          <TableCell className="max-w-[360px]">
                            <div className="truncate text-sm">{transaction.description || "-"}</div>
                            {transaction.milestoneId ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto px-0 py-0 text-xs"
                                onClick={() => navigate(`/transactions?milestone=${transaction.milestoneId}`)}
                              >
                                View milestone
                              </Button>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {transaction.transactionHash ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-2 font-mono"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(transaction.transactionHash!)
                                  showToast.success("Hash copied")
                                }}
                                title={transaction.transactionHash}
                              >
                                <Copy className="h-4 w-4" />
                                {transaction.transactionHash.substring(0, 10)}…
                              </Button>
                            ) : transaction.walletAddress ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-2 font-mono"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(transaction.walletAddress!)
                                  showToast.success("Address copied")
                                }}
                                title={transaction.walletAddress}
                              >
                                <Copy className="h-4 w-4" />
                                {transaction.walletAddress.substring(0, 10)}…
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setPage((p) => Math.max(1, p - 1))
                        }}
                        className={page === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {pageItems.map((it, idx) =>
                      it === "…" ? (
                        <PaginationItem key={`e-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={it}>
                          <PaginationLink
                            href="#"
                            isActive={it === page}
                            onClick={(e) => {
                              e.preventDefault()
                              setPage(it)
                            }}
                            className={totalPages <= 1 ? "pointer-events-none opacity-50" : ""}
                          >
                            {it}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setPage((p) => Math.min(totalPages, p + 1))
                        }}
                        className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Transactions

