import { useState } from "react"
import { showToast } from "../utils/toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Check, Copy } from "lucide-react"

interface ReferralCodeProps {
  code: string
}

function ReferralCode({ code }: ReferralCodeProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      showToast.success("Referral code copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast.error("Failed to copy code")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Your referral</CardTitle>
        <CardDescription>Share your code and earn rewards when friends join.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input value={code} readOnly className="font-mono tracking-wider" />
          <Button type="button" variant={copied ? "secondary" : "default"} className="gap-2" onClick={copyToClipboard}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ReferralCode

