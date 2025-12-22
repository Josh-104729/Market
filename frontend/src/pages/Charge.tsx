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
import { CreditCard, Loader2, Wallet } from "lucide-react"


function Charge() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [amount, setAmount] = useState('')
  const [paymentNetwork, setPaymentNetwork] = useState<'USDT_TRC20' | 'USDC_POLYGON'>('USDT_TRC20')
  const [loading, setLoading] = useState(false)

  const currency = useMemo(() => (paymentNetwork === "USDC_POLYGON" ? "USDC" : "USDT"), [paymentNetwork])

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

    setLoading(true)
    try {
      const response = await paymentApi.initiateCharge({
        amount: Number(amount),
        paymentNetwork: paymentNetwork,
      })
      // Redirect to the charge detail page with paymentNetwork in state
      navigate(`/charge/${response.walletAddress}`, { state: { paymentNetwork: response.paymentNetwork || paymentNetwork } })
      const currency = paymentNetwork === 'USDC_POLYGON' ? 'USDC' : 'USDT'
      showToast.success(`Wallet address generated. Please send ${currency} to the address.`)
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to initiate charge'
      showToast.error(message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Charge</div>
          <div className="text-sm text-muted-foreground">Add funds to your account balance.</div>
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
                Current balance
              </span>
              <Badge variant="secondary">USD</Badge>
            </CardTitle>
            <CardDescription>Your available balance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Number(balance.amount).toFixed(2)}</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Deposit
          </CardTitle>
          <CardDescription>Generate a wallet address and send crypto to complete your deposit.</CardDescription>
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
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["10", "25", "50", "100"].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAmount(v)}
                >
                  {v}
                </Button>
              ))}
            </div>

            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                After you generate an address, send the <b>exact amount</b> of{" "}
                {paymentNetwork === "USDC_POLYGON" ? "USDC on Polygon" : "USDT on TRC20"} to that address.
                Your balance updates automatically once confirmed.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Processing..." : "Generate address"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Charge
