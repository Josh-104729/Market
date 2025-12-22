import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function scrollToHash(hash: string) {
  const id = hash.replace("#", "").trim()
  if (!id) return
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function TermsOfService() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) scrollToHash(location.hash)
  }, [location.hash])

  const effectiveDate = "2025-12-22"
  const lastUpdated = "2025-12-22"

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Terms of Service</CardTitle>
          <div className="text-sm text-muted-foreground">
            Effective: {effectiveDate} • Last updated: {lastUpdated}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            These Terms govern your use of OmniMart. By using the Service, you agree to these
            Terms.
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Quick links</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a className="text-primary hover:underline" href="#accounts">
                Accounts
              </a>
              <a className="text-primary hover:underline" href="#acceptable-use">
                Acceptable use
              </a>
              <a className="text-primary hover:underline" href="#transactions">
                Transactions
              </a>
              <a className="text-primary hover:underline" href="#termination">
                Termination
              </a>
              <a className="text-primary hover:underline" href="#disclaimer">
                Disclaimer
              </a>
            </div>
          </div>

          <Separator />

          <section id="accounts" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">1) Accounts</h2>
            <div className="text-sm text-muted-foreground">
              You’re responsible for maintaining the confidentiality of your account credentials
              and for all activities under your account.
            </div>
          </section>

          <section id="acceptable-use" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">2) Acceptable use</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>No illegal, harmful, or abusive content or activity.</li>
              <li>No attempts to exploit, scrape, or disrupt the Service.</li>
              <li>No unauthorized access to accounts or systems.</li>
            </ul>
          </section>

          <section id="transactions" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">3) Transactions</h2>
            <div className="text-sm text-muted-foreground">
              Payments, fees, and dispute processes may depend on the payment method/network in
              use. You agree to provide accurate information and comply with applicable laws.
            </div>
          </section>

          <section id="termination" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">4) Termination</h2>
            <div className="text-sm text-muted-foreground">
              We may suspend or terminate access if you violate these Terms or if necessary to
              protect the Service or users.
            </div>
          </section>

          <section id="disclaimer" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">5) Disclaimer</h2>
            <div className="text-sm text-muted-foreground">
              The Service is provided “as is” without warranties of any kind to the maximum extent
              permitted by law.
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}


