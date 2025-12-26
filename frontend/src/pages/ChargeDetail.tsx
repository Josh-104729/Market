import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { paymentApi, Balance } from "../services/api"
import { showToast } from "../utils/toast"
import { getSocket } from "../services/socket"
import type { Socket } from "socket.io-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, Clock, Copy, ExternalLink, Loader2, QrCode, Wallet } from "lucide-react"

interface ChargeData {
  walletAddress: string
  amount: number
  platformFee: number
  total: number
  transactionId: string
  expiresAt: string
  status: string
  transactionHash?: string
  paymentNetwork?: 'USDT_TRC20' | 'USDC_POLYGON'
}

function ChargeDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { walletAddress } = useParams<{ walletAddress: string }>()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [chargeData, setChargeData] = useState<ChargeData | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  
  // Get paymentNetwork from location state (passed from Charge page)
  const paymentNetworkFromState = location.state?.paymentNetwork as 'USDT_TRC20' | 'USDC_POLYGON' | undefined
  const currency = useMemo(() => (chargeData?.paymentNetwork === "USDC_POLYGON" ? "USDC" : "USDT"), [chargeData?.paymentNetwork])
  const networkLabel = useMemo(
    () => (chargeData?.paymentNetwork === "USDC_POLYGON" ? "USDC (Polygon)" : "USDT (TRC20)"),
    [chargeData?.paymentNetwork],
  )

  useEffect(() => {
    if (!walletAddress) {
      showToast.error('Invalid wallet address')
      navigate('/charge')
      return
    }

    // Fetch balance
    paymentApi.getBalance()
      .then(setBalance)
      .catch((error) => {
        console.error('Failed to fetch balance:', error)
      })

    // Fetch charge data
    paymentApi.getChargeByWalletAddress(walletAddress)
      .then((data) => {
        // Ensure paymentNetwork has a default value if not provided
        // Priority: 1. From API response, 2. From location state, 3. Default to USDT_TRC20
        const chargeDataWithNetwork = {
          ...data,
          paymentNetwork: data.paymentNetwork || paymentNetworkFromState || 'USDT_TRC20' as 'USDT_TRC20' | 'USDC_POLYGON'
        }
        setChargeData(chargeDataWithNetwork)
        setTransactionStatus(data.status)
      })
      .catch((error) => {
        console.error('Failed to fetch charge data:', error)
        showToast.error('Failed to load charge information')
        navigate('/charge')
      })
      .finally(() => {
        setLoading(false)
      })

    // Set up WebSocket listener for balance updates
    const socket = getSocket()
    if (socket) {
      socketRef.current = socket

      const handleBalanceUpdate = (data: { balance: Balance }) => {
        // Update balance immediately when received via WebSocket
        setBalance(data.balance)
      }

      socket.on('balance_updated', handleBalanceUpdate)

      return () => {
        if (socketRef.current) {
          socketRef.current.off('balance_updated', handleBalanceUpdate)
        }
      }
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current)
      }
    }
  }, [walletAddress, navigate])

  // Countdown timer effect - updates every second
  useEffect(() => {
    if (chargeData && transactionStatus === 'pending' && chargeData.expiresAt) {
      // Update countdown immediately
      setTimeRemaining(getTimeRemaining(chargeData.expiresAt))

      // Update countdown every second
      countdownRef.current = window.setInterval(() => {
        const remaining = getTimeRemaining(chargeData.expiresAt)
        setTimeRemaining(remaining)

        // If expired, stop the countdown
        if (remaining === 'Expired') {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current)
          }
        }
      }, 1000) // Update every second

      return () => {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current)
        }
      }
    } else {
      setTimeRemaining('')
    }
  }, [chargeData, transactionStatus])

  useEffect(() => {
    if (chargeData && transactionStatus === 'pending' && walletAddress) {
      // Start polling for status updates - refresh both status and full charge data
      intervalRef.current = window.setInterval(async () => {
        try {
          // Fetch both status and full charge data for real-time updates
          const [status, updatedChargeData] = await Promise.all([
            paymentApi.getChargeStatus(chargeData.transactionId),
            paymentApi.getChargeByWalletAddress(walletAddress).catch(() => null),
          ])

          // Update status
          const newStatus = status.status
          setTransactionStatus(newStatus)

          // Update charge data if available
          if (updatedChargeData) {
            setChargeData(updatedChargeData)
          }

          if (newStatus === 'success') {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current)
            }
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current)
            }
            showToast.success('Payment received! Your balance has been updated.')
            // Refresh balance
            const updatedBalance = await paymentApi.getBalance()
            setBalance(updatedBalance)
          } else if (newStatus === 'cancelled' || newStatus === 'failed') {
            if (intervalRef.current) {
              window.clearInterval(intervalRef.current)
            }
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current)
            }
            const msg =
              newStatus === 'failed'
                ? status.description || 'Transaction failed'
                : 'Transaction was cancelled'
            showToast.error(msg)
          }
        } catch (error) {
          console.error('Failed to check transaction status:', error)
        }
      }, 3000) // Poll every 3 seconds for faster updates

      return () => {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current)
        }
      }
    }
  }, [chargeData, transactionStatus, walletAddress])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
  }

  const generateQRCode = (text: string): string => {
    // Using a QR code API service
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`
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

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime()
    const expiry = new Date(expiresAt).getTime()
    const diff = expiry - now

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    // Format with leading zeros for better display
    const h = hours.toString().padStart(2, '0')
    const m = minutes.toString().padStart(2, '0')
    const s = seconds.toString().padStart(2, '0')
    
    return `${h}:${m}:${s}`
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!chargeData) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10">
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <div className="text-sm text-muted-foreground">Charge information not found.</div>
            <div>
              <Button type="button" onClick={() => navigate("/charge")}>
                Back to Charge
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusVariant: "secondary" | "outline" = transactionStatus === "success" ? "secondary" : "outline"
  const statusLabel =
    transactionStatus === "success"
      ? "Paid"
      : transactionStatus === "pending"
        ? "Waiting for payment"
        : transactionStatus
          ? transactionStatus.toUpperCase()
          : "UNKNOWN"

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Charge details</div>
          <div className="text-sm text-muted-foreground">
            Send <b>{currency}</b> on <b>{networkLabel}</b> to the address below.
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate("/charge")}>
          {transactionStatus === "success" ? "Charge again" : "Back"}
        </Button>
      </div>

      {balance ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Current balance
            </CardTitle>
            <CardDescription>Updates automatically after payment confirmation.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Number(balance.amount).toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">USD</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Payment status</CardTitle>
              <CardDescription>We’ll keep checking while this is pending.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant} className="gap-2">
                {transactionStatus === "success" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {statusLabel}
              </Badge>
              {transactionStatus === "pending" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking...
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="rounded-xl border bg-card p-4">
              <img
                src={generateQRCode(chargeData.walletAddress)}
                alt="Wallet Address QR Code"
                className="h-64 w-64 bg-white p-3"
              />
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <QrCode className="h-3 w-3" />
                Scan to copy address in your wallet
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Wallet address</div>
            <div className="flex items-center gap-2">
              <Input value={chargeData.walletAddress} readOnly className="font-mono text-xs sm:text-sm" />
              <Button type="button" variant="secondary" className="gap-2" onClick={() => copyToClipboard(chargeData.walletAddress)}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-semibold">Amount</div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">{networkLabel}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{Number(chargeData.amount).toFixed(2)} {currency}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Platform fee</span>
                <span className="font-medium">{Number(chargeData.platformFee).toFixed(2)} {currency}</span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total to send</span>
                <span className="text-lg font-bold">{Number(chargeData.total).toFixed(2)} {currency}</span>
              </div>
            </div>
          </div>

          {transactionStatus === "pending" && chargeData.expiresAt ? (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Time remaining</AlertTitle>
              <AlertDescription>
                <div className="mt-2 flex items-center justify-between gap-4 rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">Expires at: {formatDate(chargeData.expiresAt)}</div>
                  <div className="font-mono text-lg font-semibold">
                    {timeRemaining || getTimeRemaining(chargeData.expiresAt)}
                  </div>
                </div>
                {timeRemaining === "Expired" ? (
                  <div className="mt-2 text-sm text-destructive">This transaction has expired.</div>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>Instructions</AlertTitle>
            <AlertDescription>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  Send exactly <b>{Number(chargeData.total).toFixed(2)} {currency}</b> to the wallet address above.
                </li>
                <li>
                  Make sure you’re sending <b>{currency}</b> on <b>{networkLabel}</b>.
                </li>
                <li>Your balance will update automatically once the payment is confirmed.</li>
                <li>This page updates automatically when payment is received.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {transactionStatus === "pending" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                  disabled={cancelling}
                >
                  Cancel charge
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    if (chargeData.paymentNetwork === "USDC_POLYGON") {
                      window.open(`https://polygonscan.com/address/${chargeData.walletAddress}`, "_blank")
                    } else {
                      window.open(`https://tronscan.org/#/address/${chargeData.walletAddress}`, "_blank")
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                  View on {chargeData.paymentNetwork === "USDC_POLYGON" ? "PolygonScan" : "TronScan"}
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this charge?</DialogTitle>
            <DialogDescription>
              This will cancel the pending charge request. If you already sent funds, do not cancel — wait for confirmation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep waiting
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              className="gap-2"
              onClick={async () => {
                try {
                  setCancelling(true)
                  await paymentApi.cancelCharge(chargeData.transactionId)

                  if (intervalRef.current) window.clearInterval(intervalRef.current)
                  if (countdownRef.current) window.clearInterval(countdownRef.current)

                  setTransactionStatus("cancelled")
                  setChargeData((prev) => (prev ? { ...prev, status: "cancelled" } : prev))
                  showToast.success("Charge cancelled")
                  setCancelOpen(false)
                } catch (err: any) {
                  const msg = err.response?.data?.message || "Failed to cancel charge"
                  showToast.error(msg)
                } finally {
                  setCancelling(false)
                }
              }}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {cancelling ? "Cancelling..." : "Cancel charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ChargeDetail

