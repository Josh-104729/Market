import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { paymentApi, Balance } from "../services/api"
import { showToast } from "../utils/toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Wallet, ArrowUpRight, AlertTriangle } from "lucide-react"

function Withdraw() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [paymentNetwork, setPaymentNetwork] = useState<'USDT_TRC20' | 'USDC_POLYGON'>('USDT_TRC20')
  const [loading, setLoading] = useState(false)

  const currency = useMemo(() => (paymentNetwork === "USDC_POLYGON" ? "USDC" : "USDT"), [paymentNetwork])
  const walletLabel = useMemo(() => (paymentNetwork === "USDC_POLYGON" ? "Polygon" : "TRC20"), [paymentNetwork])

  useEffect(() => {
    paymentApi.getBalance()
      .then(setBalance)
      .catch((error) => {
        console.error('Failed to fetch balance:', error)
        showToast.error('Failed to load balance')
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!amount || Number(amount) <= 0) {
      showToast.error('Please enter a valid amount')
      return
    }

    // Validate minimum withdrawal amount (5)
    if (Number(amount) < 5) {
      showToast.error(`Minimum withdrawal amount is 5 ${currency}`)
      return
    }

    // Validate amount doesn't exceed balance
    if (!balance || Number(amount) > Number(balance.amount)) {
      showToast.error(`Insufficient balance. Available: ${Number(balance?.amount || 0).toFixed(2)} ${currency}`)
      return
    }

    if (!walletAddress.trim()) {
      showToast.error('Please enter wallet address')
      return
    }

    // Validate wallet address format based on network
    if (paymentNetwork === 'USDC_POLYGON') {
      // Polygon addresses are Ethereum addresses (0x followed by 40 hex characters)
      if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress.trim())) {
        showToast.error('Please enter a valid Polygon wallet address (0x followed by 40 hex characters)')
        return
      }
    } else {
      // Basic TRC20 address validation (starts with T and is 34 characters)
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress.trim())) {
        showToast.error('Please enter a valid TRC20 wallet address')
        return
      }
    }

    setLoading(true)
    try {
      await paymentApi.withdraw({
        amount: Number(amount),
        walletAddress: walletAddress.trim(),
        paymentNetwork: paymentNetwork,
      })
      showToast.success('Withdrawal request submitted successfully. It will be processed by admin.')
      setAmount('')
      setWalletAddress('')
      // Refresh balance
      const updatedBalance = await paymentApi.getBalance()
      setBalance(updatedBalance)
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to process withdrawal'
      showToast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleMaxAmount = () => {
    if (balance) {
      setAmount(Number(balance.amount).toFixed(2))
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Withdraw</div>
          <div className="text-sm text-muted-foreground">Withdraw funds to your wallet address.</div>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {balance ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Available balance
              </span>
              <Badge variant="secondary">USD</Badge>
            </CardTitle>
            <CardDescription>Your current balance available for withdrawal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Number(balance.amount).toFixed(2)}</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5" />
            Withdrawal request
          </CardTitle>
          <CardDescription>Requests are reviewed and processed by admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment network</Label>
                <Select value={paymentNetwork} onValueChange={(v) => setPaymentNetwork(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT_TRC20">USDT (TRC20)</SelectItem>
                    <SelectItem value="USDC_POLYGON">USDC (Polygon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount ({currency})</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="5"
                    max={balance ? Number(balance.amount) : undefined}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5.00"
                    required
                  />
                  <Button type="button" variant="secondary" onClick={handleMaxAmount} disabled={!balance}>
                    Max
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Minimum withdrawal amount: <b>5 {currency}</b>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{walletLabel} wallet address</Label>
              <Input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder={paymentNetwork === "USDC_POLYGON" ? "0x..." : "Txxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                className="font-mono text-sm"
                required
              />
              <div className="text-xs text-muted-foreground">
                {paymentNetwork === "USDC_POLYGON"
                  ? "Polygon address must be 0x followed by 40 hex characters."
                  : "TRC20 address must start with T and be 34 characters."}
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Double-check your address</AlertTitle>
              <AlertDescription>
                Withdrawals are processed manually. If you submit a wrong address, funds may be lost and cannot be recovered.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Processing..." : "Submit withdrawal"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Withdraw

