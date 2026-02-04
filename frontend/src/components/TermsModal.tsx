import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { authApi } from "../services/api"
import { useAppDispatch } from "../store/hooks"
import { updateUser } from "../store/slices/authSlice"
import { showToast } from "../utils/toast"

interface TermsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept?: () => void
}

export function TermsModal({ open, onOpenChange, onAccept }: TermsModalProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [accepting, setAccepting] = useState(false)

  const effectiveDate = "2025-12-22"
  const lastUpdated = "2026-02-04"

  const handleAccept = async () => {
    try {
      setAccepting(true)
      await authApi.acceptTerms()
      dispatch(updateUser({ termsAcceptedAt: new Date().toISOString() }))
      showToast.success("Terms of Service accepted")
      onOpenChange(false)
      if (onAccept) {
        onAccept()
      }
    } catch (error: any) {
      console.error("Failed to accept terms:", error)
      showToast.error(error.response?.data?.message || "Failed to accept terms")
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] flex flex-col [&>button]:hidden" 
        onInteractOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Terms of Service</DialogTitle>
          <DialogDescription>
            Effective: {effectiveDate} • Last updated: {lastUpdated}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-8">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            These Terms govern your use of OmniMart (the "Service"). Our goal is to make OmniMart a safe, trusted, and easy‑to‑use place for everyone. By accessing or using the Service, you agree to these Terms. If you do not agree, please do not use the Service.
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Quick Links</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a className="text-primary hover:underline" href="#accounts">
                Accounts
              </a>
              <a className="text-primary hover:underline" href="#acceptable-use">
                Acceptable Use
              </a>
              <a className="text-primary hover:underline" href="#safety-fraud">
                Safety, Fraud Prevention & Monitoring
              </a>
              <a className="text-primary hover:underline" href="#transactions">
                Transactions & Payments
              </a>
              <a className="text-primary hover:underline" href="#enforcement">
                Enforcement & Termination
              </a>
              <a className="text-primary hover:underline" href="#disclaimer">
                Disclaimer
              </a>
            </div>
          </div>

          <Separator />

          <section id="accounts" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">1) Accounts</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. We ask that you:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Provide accurate and up‑to‑date information.</li>
                <li>Keep your login details secure.</li>
                <li>Let OmniMart know promptly if you suspect unauthorized use or a security issue.</li>
              </ul>
              <p>You remain responsible for the content you post and the actions you take while using the Service.</p>
            </div>
          </section>

          <section id="acceptable-use" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">2) Acceptable Use</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>OmniMart is built on trust and respectful interaction. When using the Service, please avoid activity that is illegal, harmful, deceptive, abusive, or disruptive. This includes, for example:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Attempting to exploit, scrape, reverse‑engineer, or interfere with the Service.</li>
                <li>Trying to access accounts, systems, or data without authorization.</li>
                <li>Misrepresenting who you are or your intentions.</li>
              </ul>
              <p>Most users will never encounter issues here—these rules exist to protect the community as a whole.</p>
            </div>
          </section>

          <section id="safety-fraud" className="space-y-4 scroll-mt-24">
            <h2 className="text-lg font-semibold">3) Safety, Fraud Prevention & Monitoring</h2>
            <div className="text-sm text-muted-foreground space-y-4">
              <p>User safety is important to us. To help prevent scams and misuse, OmniMart uses a combination of automated tools (including AI‑based fraud detection) and manual review by our team to check chat content and activity.</p>
              <p>These reviews are designed to identify risky patterns, not to penalize normal conversations. The vast majority of users are never affected, and reviews are applied in a reasonable and proportionate way.</p>
              
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">A) Keeping Communication On‑Platform</h3>
                  <p className="mb-2">For everyone's protection, we encourage users to keep conversations and transactions within OmniMart. Please try to avoid:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Sharing or requesting phone numbers (calls or SMS).</li>
                    <li>Sharing or requesting email addresses.</li>
                    <li>Asking to move chats to external messaging services such as WhatsApp, Telegram, WeChat, Signal, Discord, or similar platforms.</li>
                    <li>Requests to continue the conversation elsewhere (for example, "contact me directly" or "let's talk outside the platform").</li>
                    <li>Sharing social media handles or links other than LinkedIn.</li>
                  </ul>
                  <p className="mt-2">Certain patterns—such as contact IDs that resemble email or messaging usernames (including those using an "@" symbol)—may be flagged automatically for review.</p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">LinkedIn Clarification (Allowed)</h4>
                  <p>The following are generally acceptable and do not, by themselves, indicate fraud:</p>
                  <ul className="list-disc space-y-1 pl-5 mt-1">
                    <li>Sharing LinkedIn profile URLs or LinkedIn identifiers (for example, linkedin.com/in/username).</li>
                    <li>Mentioning LinkedIn without encouraging off‑platform communication.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">B) Payments & Staying Within OmniMart</h3>
                  <p className="mb-2">To keep transactions transparent and supported, OmniMart asks that payments be completed using the Service's approved payment systems. Please avoid:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Offering to send or receive money outside OmniMart.</li>
                    <li>Sharing instructions or details for external payment methods, including PayPal, bank or wire transfers, Venmo, Cash App, Zelle, or cryptocurrency wallets.</li>
                    <li>Suggesting ways to bypass OmniMart's payment flow.</li>
                  </ul>
                  <p className="mt-2">General conversations about pricing or payment options are usually fine. However, sharing direct external payment details may trigger a review.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">C) What Is Usually Fine</h3>
                  <p>The following alone are not considered fraud, though they may be reviewed in context:</p>
                  <ul className="list-disc space-y-1 pl-5 mt-1">
                    <li>General discussions about prices or payment concepts without sharing external payment instructions.</li>
                    <li>References to payment methods without account numbers, wallet addresses, or transfer instructions.</li>
                    <li>Sharing personal details such as physical addresses or dates of birth (while we still encourage caution for your own safety).</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section id="transactions" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">4) Transactions & Payments</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Payments, fees, refunds, and dispute handling are managed through OmniMart's approved payment systems and applicable payment networks. By completing a transaction, you agree to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Use only payment methods supported within the Service.</li>
                <li>Provide accurate billing and transaction information.</li>
                <li>Follow applicable laws and regulations.</li>
              </ul>
              <p>Transactions conducted outside OmniMart are not covered by platform protections.</p>
            </div>
          </section>

          <section id="enforcement" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">5) Enforcement & Termination</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>If activity appears to violate these Terms or poses a risk to users or the Service, OmniMart may take reasonable actions such as:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Removing or limiting access to certain content.</li>
                <li>Temporarily restricting account features.</li>
                <li>Suspending or terminating accounts in cases of serious or repeated misuse.</li>
              </ul>
              <p>We aim to act fairly and proportionately, focusing on safety rather than punishment.</p>
            </div>
          </section>

          <section id="disclaimer" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">6) Disclaimer</h2>
            <div className="text-sm text-muted-foreground">
              <p>The Service is provided "as is" and "as available", without warranties of any kind, to the maximum extent permitted by law. OmniMart does not guarantee uninterrupted availability, error‑free operation, or suitability for a particular purpose.</p>
            </div>
          </section>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              navigate("/terms")
            }}
          >
            View Full Terms
          </Button>
          <Button onClick={handleAccept} disabled={accepting}>
            {accepting ? "Accepting..." : "I Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

