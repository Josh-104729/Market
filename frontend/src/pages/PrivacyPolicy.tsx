import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

function scrollToHash(hash: string) {
  const id = hash.replace("#", "").trim()
  if (!id) return
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export default function PrivacyPolicy() {
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
          <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          <div className="text-sm text-muted-foreground">
            Effective: {effectiveDate} • Last updated: {lastUpdated}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            This Privacy Policy explains how OmniMart (“we”, “us”) collects, uses, and shares
            information when you use the OmniMart website and services (the “Service”).
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Quick links</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a className="text-primary hover:underline" href="#information-we-collect">
                Information we collect
              </a>
              <a className="text-primary hover:underline" href="#how-we-use">
                How we use information
              </a>
              <a className="text-primary hover:underline" href="#sharing">
                Sharing
              </a>
              <a className="text-primary hover:underline" href="#security">
                Security
              </a>
              <a className="text-primary hover:underline" href="#your-rights">
                Your rights
              </a>
              <a className="text-primary hover:underline" href="#contact">
                Contact
              </a>
            </div>
          </div>

          <Separator />

          <section id="information-we-collect" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">1) Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Account details (email, name/username, profile info, avatar).</li>
              <li>Content you provide (messages, listings, posts, attachments).</li>
              <li>Usage data (pages visited, interactions, device/browser info).</li>
              <li>
                Payment-related data (transaction metadata). We do not store full card details
                if a third-party processor is used.
              </li>
            </ul>
          </section>

          <section id="how-we-use" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">2) How we use information</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Provide and operate the Service (auth, profiles, chat, listings).</li>
              <li>Improve features, reliability, and user experience.</li>
              <li>Prevent fraud, abuse, and security incidents.</li>
              <li>Send service messages (verification, security, notifications).</li>
            </ul>
          </section>

          <section id="sharing" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">3) Sharing</h2>
            <div className="text-sm text-muted-foreground">
              We may share information with vendors that help run the Service (hosting, storage,
              analytics, email) and when required by law. Public profile data you choose to
              display may be visible to other users.
            </div>
          </section>

          <section id="security" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">4) Security</h2>
            <div className="text-sm text-muted-foreground">
              We use reasonable safeguards to protect your information. No method of transmission
              or storage is 100% secure, so we cannot guarantee absolute security.
            </div>
          </section>

          <section id="your-rights" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">5) Your rights & choices</h2>
            <div className="text-sm text-muted-foreground">
              You can update most profile information from your account settings. You may request
              access, correction, or deletion subject to legal/operational requirements.
            </div>
          </section>

          <section id="contact" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">6) Contact</h2>
            <div className="text-sm text-muted-foreground">
              Questions about this policy? Contact support via the{" "}
              <Link to="/support" className="text-primary hover:underline">
                Help page
              </Link>{" "}
              (or your configured support email).
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}


