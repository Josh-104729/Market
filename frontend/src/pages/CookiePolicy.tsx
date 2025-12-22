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

export default function CookiePolicy() {
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
          <CardTitle className="text-2xl">Cookie Policy</CardTitle>
          <div className="text-sm text-muted-foreground">
            Effective: {effectiveDate} • Last updated: {lastUpdated}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            This Cookie Policy explains how OmniMart uses cookies and similar technologies.
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Quick links</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <a className="text-primary hover:underline" href="#what-are-cookies">
                What are cookies
              </a>
              <a className="text-primary hover:underline" href="#how-we-use-cookies">
                How we use cookies
              </a>
              <a className="text-primary hover:underline" href="#choices">
                Your choices
              </a>
            </div>
          </div>

          <Separator />

          <section id="what-are-cookies" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">1) What are cookies?</h2>
            <div className="text-sm text-muted-foreground">
              Cookies are small text files stored on your device. Similar technologies may include
              local storage or device identifiers.
            </div>
          </section>

          <section id="how-we-use-cookies" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">2) How we use cookies</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Essential: authentication and security.</li>
              <li>Preferences: theme and UI settings.</li>
              <li>Analytics: understand usage to improve the Service (where enabled).</li>
            </ul>
          </section>

          <section id="choices" className="space-y-2 scroll-mt-24">
            <h2 className="text-lg font-semibold">3) Your choices</h2>
            <div className="text-sm text-muted-foreground">
              You can control cookies via your browser settings. Disabling certain cookies may
              impact functionality.
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}


