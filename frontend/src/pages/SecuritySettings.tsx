import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { authApi } from "../services/api"
import { showToast } from "../utils/toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, Copy, KeyRound, Loader2, QrCode, Shield, XCircle } from "lucide-react"

function SecuritySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [setupStep, setSetupStep] = useState<"idle" | "qr" | "backup">("idle")
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [password, setPassword] = useState("")
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    load2FAStatus()
  }, [])

  const load2FAStatus = async () => {
    try {
      setInitialLoading(true)
      const status = await authApi.twoFactor.getStatus()
      setTwoFactorEnabled(!!status.enabled)
      setTwoFactorMethod(status.method || null)
    } catch (error) {
      console.error("Failed to load 2FA status:", error)
    }
    finally {
      setInitialLoading(false)
    }
  }

  const handleEnable2FA = async () => {
    setLoading(true)
    try {
      const result = await authApi.twoFactor.enable("totp")
      setQrCodeUrl(result.qrCodeUrl)
      setSetupStep("qr")
    } catch (error: any) {
      showToast.error(error.response?.data?.message || "Failed to enable 2FA")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifySetup = async () => {
    setLoading(true)
    try {
      const result = await authApi.twoFactor.verifySetup(verificationCode)
      setBackupCodes(result.backupCodes || [])
      setSetupStep("backup")
      setShowBackupCodes(true)
      showToast.success("2FA enabled successfully!")
      await load2FAStatus()
      // Dispatch event to notify Layout component
      window.dispatchEvent(new CustomEvent("2fa-status-updated"))
    } catch (error: any) {
      showToast.error(error.response?.data?.message || "Invalid verification code")
    } finally {
      setLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!password) {
      showToast.error("Please enter your password")
      return
    }

    setLoading(true)
    try {
      await authApi.twoFactor.disable(password)
      showToast.success("2FA disabled successfully")
      setTwoFactorEnabled(false)
      setTwoFactorMethod(null)
      setPassword("")
      setSetupStep("idle")
      // Dispatch event to notify Layout component
      window.dispatchEvent(new CustomEvent("2fa-status-updated"))
    } catch (error: any) {
      showToast.error(error.response?.data?.message || "Failed to disable 2FA")
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    if (!password) {
      showToast.error("Please enter your password")
      return
    }

    setLoading(true)
    try {
      const result = await authApi.twoFactor.regenerateBackupCodes(password)
      setBackupCodes(result.backupCodes || [])
      setShowBackupCodes(true)
      setPassword("")
      showToast.success("Backup codes regenerated")
    } catch (error: any) {
      showToast.error(error.response?.data?.message || "Failed to regenerate backup codes")
    } finally {
      setLoading(false)
    }
  }

  const canVerify = verificationCode.length === 6

  const backupCodesText = useMemo(() => backupCodes.join("\n"), [backupCodes])

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodesText)
      showToast.success("Backup codes copied!")
    } catch {
      showToast.error("Failed to copy backup codes")
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold tracking-tight">Security</div>
          <div className="text-sm text-muted-foreground">Manage two-factor authentication and backup codes.</div>
        </div>
        <Button asChild variant="outline">
          <Link to="/profile">Back</Link>
        </Button>
      </div>

      {initialLoading ? (
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-40" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Two-factor authentication (2FA)
                </CardTitle>
                <CardDescription>Use an authenticator app to protect your account.</CardDescription>
              </div>
              <Badge variant={twoFactorEnabled ? "secondary" : "outline"} className="gap-2">
                {twoFactorEnabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {twoFactorEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!twoFactorEnabled ? (
              <div className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Recommended</AlertTitle>
                  <AlertDescription>
                    Enabling 2FA helps prevent unauthorized access even if your password is compromised.
                  </AlertDescription>
                </Alert>

                {setupStep === "idle" ? (
                  <Button type="button" onClick={handleEnable2FA} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    {loading ? "Setting up..." : "Enable 2FA"}
                  </Button>
                ) : null}

                {setupStep === "qr" ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6‑digit code.
                    </div>

                    <div className="flex justify-center">
                      <div className="rounded-xl border bg-card p-4">
                        <img src={qrCodeUrl} alt="QR Code" className="h-56 w-56 bg-white p-3" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        Verification code
                      </Label>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={verificationCode}
                          onChange={(value) => setVerificationCode(value.replace(/\D/g, "").slice(0, 6))}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <div className="text-xs text-muted-foreground">Enter the 6 digits from your authenticator app.</div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSetupStep("idle")
                          setQrCodeUrl("")
                          setVerificationCode("")
                        }}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleVerifySetup} disabled={loading || !canVerify} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {loading ? "Verifying..." : "Verify & enable"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {setupStep === "backup" && showBackupCodes && backupCodes.length > 0 ? (
                  <div className="space-y-4">
                    <Alert>
                      <KeyRound className="h-4 w-4" />
                      <AlertTitle>Save your backup codes</AlertTitle>
                      <AlertDescription>
                        Store these codes in a safe place. You can use them if you lose access to your authenticator app.
                      </AlertDescription>
                    </Alert>

                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {backupCodes.map((code, idx) => (
                          <div key={idx} className="rounded-md border bg-background px-3 py-2 text-center font-mono text-sm">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                      <Button type="button" variant="outline" onClick={copyBackupCodes} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setSetupStep("idle")
                          setShowBackupCodes(false)
                          setBackupCodes([])
                          setVerificationCode("")
                          setQrCodeUrl("")
                        }}
                      >
                        I saved them
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground">2FA is enabled</div>
                    <div className="text-xs text-muted-foreground">Method: {twoFactorMethod?.toUpperCase()}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Disable 2FA</div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                    <Button type="button" variant="destructive" onClick={handleDisable2FA} disabled={loading} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Disable
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold">Backup codes</div>
                    <div className="text-xs text-muted-foreground">Regenerate codes if you used them or need new ones.</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                    <Button type="button" variant="secondary" onClick={handleRegenerateBackupCodes} disabled={loading} className="gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Regenerate
                    </Button>
                  </div>

                  {showBackupCodes && backupCodes.length > 0 ? (
                    <div className="space-y-4 pt-2">
                      <Alert>
                        <KeyRound className="h-4 w-4" />
                        <AlertTitle>New codes generated</AlertTitle>
                        <AlertDescription>Save them now — they won’t be shown again.</AlertDescription>
                      </Alert>

                      <div className="rounded-lg border bg-muted/20 p-4">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {backupCodes.map((code, idx) => (
                            <div key={idx} className="rounded-md border bg-background px-3 py-2 text-center font-mono text-sm">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                        <Button type="button" variant="outline" onClick={copyBackupCodes} className="gap-2">
                          <Copy className="h-4 w-4" />
                          Copy
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setShowBackupCodes(false)
                            setBackupCodes([])
                          }}
                        >
                          I saved them
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SecuritySettings

