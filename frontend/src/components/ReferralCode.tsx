import { useMemo, useState } from "react"
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
  const referralLink = useMemo(() => {
    // If the signup flow expects a referral param, this keeps it usable; otherwise users can still copy the code.
    return `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`
  }, [code])

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      showToast.success("Referral link copied!")
    } catch {
      showToast.error("Failed to copy link")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Your referral</CardTitle>
        <CardDescription>Share your code (or link) and earn rewards when friends join.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input value={code} readOnly className="font-mono tracking-wider" />
          <Button type="button" variant={copied ? "secondary" : "default"} className="gap-2" onClick={copyToClipboard}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <Input value={referralLink} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" className="gap-2" onClick={copyLink}>
            <Copy className="h-4 w-4" />
            Copy link
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ReferralCode

