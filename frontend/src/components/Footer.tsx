import { Link } from "react-router-dom"
import { useAppSelector } from "../store/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { showToast } from "../utils/toast"
import { Github, Instagram, Linkedin, Send, Twitter } from "lucide-react"

function Footer() {
  const currentYear = new Date().getFullYear()
  const { isAuthenticated } = useAppSelector((state) => state.auth)

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="container mx-auto px-14 py-10">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <span className="text-lg font-bold">O</span>
              </div>
              <div className="text-lg font-bold tracking-tight">OmniMart</div>
            </Link>
            <p className="max-w-sm text-sm text-muted-foreground">
              A modern marketplace where anyone can sell and buy services. Discover talent, hire fast, and keep everything in one place.
            </p>

            {/* Social */}
            <div className="flex items-center gap-2 pt-1">
              <Button variant="ghost" size="icon" asChild>
                <a href="#" aria-label="Twitter">
                  <Twitter className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="#" aria-label="LinkedIn">
                  <Linkedin className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="#" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="#" aria-label="GitHub">
                  <Github className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Product</div>
            <div className="space-y-2 text-sm">
              <Link to="/services" className="block text-muted-foreground hover:text-foreground">
                Explore services
              </Link>
              <Link to="/feed" className="block text-muted-foreground hover:text-foreground">
                Community feed
              </Link>
              {isAuthenticated ? (
                <Link to="/notifications" className="block text-muted-foreground hover:text-foreground">
                  Notifications
                </Link>
              ) : null}
              <Link to="/referral" className="block text-muted-foreground hover:text-foreground">
                Referral program
              </Link>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Account</div>
            <div className="space-y-2 text-sm">
              {isAuthenticated ? (
                <>
                  <Link to="/profile" className="block text-muted-foreground hover:text-foreground">
                    Profile
                  </Link>
                  <Link to="/transactions" className="block text-muted-foreground hover:text-foreground">
                    Transactions
                  </Link>
                  <Link to="/charge" className="block text-muted-foreground hover:text-foreground">
                    Charge
                  </Link>
                  <Link to="/withdraw" className="block text-muted-foreground hover:text-foreground">
                    Withdraw
                  </Link>
                  <Link to="/settings/security" className="block text-muted-foreground hover:text-foreground">
                    Security settings
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/signin" className="block text-muted-foreground hover:text-foreground">
                    Sign in
                  </Link>
                  <Link to="/signup" className="block text-muted-foreground hover:text-foreground">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Help */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">Help</div>
            <div className="space-y-2 text-sm">
              <a href="#" className="block text-muted-foreground hover:text-foreground">
                Help center
              </a>
              <a href="#" className="block text-muted-foreground hover:text-foreground">
                Contact
              </a>
              <a href="#" className="block text-muted-foreground hover:text-foreground">
                Community guidelines
              </a>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>© {currentYear} OmniMart. All rights reserved.</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

