import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authApi, unblockRequestApi } from '../services/api';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import { showToast } from '../utils/toast';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";

function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams()
  const dispatch = useAppDispatch();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'email'>('totp');
  
  // Unblock request state
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [unblockTitle, setUnblockTitle] = useState('');
  const [unblockMessage, setUnblockMessage] = useState('');
  const [submittingUnblock, setSubmittingUnblock] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const isBlocked = error === 'Your account is blocked';

  const redirectParam = searchParams.get("redirect")
  const redirectTo = (() => {
    if (!redirectParam) return "/"
    try {
      const decoded = decodeURIComponent(redirectParam)
      return decoded.startsWith("/") ? decoded : "/"
    } catch {
      return "/"
    }
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.signIn(formData);
      
      if (response.requires2FA) {
        setRequires2FA(true);
        setTempToken(response.tempToken);
        setTwoFactorMethod(response.method || 'totp');
        showToast.info('Please enter your 2FA code');
      } else {
        dispatch(setCredentials({ user: response.user, accessToken: response.accessToken }));
        showToast.success('Welcome back!');
        // Terms modal will be shown in App.tsx after user is set
        navigate(redirectTo);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid email or password';
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;

    setError('');
    setLoading(true);

    try {
      const response = await authApi.twoFactor.verifyLogin(tempToken, twoFactorCode);
      dispatch(setCredentials({ user: response.user, accessToken: response.accessToken }));
      showToast.success('Welcome back!');
      navigate(redirectTo);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Invalid 2FA code';
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockRequest = async () => {
    if (!unblockTitle.trim()) {
      showToast.error('Please enter a title');
      return;
    }
    if (!unblockMessage.trim()) {
      showToast.error('Please enter a message');
      return;
    }

    setSubmittingUnblock(true);
    try {
      await unblockRequestApi.sendEmail(formData.email, unblockTitle.trim(), unblockMessage.trim());
      showToast.success('Your request is submitted, support team will review within 24 hours');
      setShowUnblockModal(false);
      setUnblockTitle('');
      setUnblockMessage('');
      setRequestSubmitted(true); // Hide the button after submission
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to submit unblock request';
      showToast.error(errorMessage);
    } finally {
      setSubmittingUnblock(false);
    }
  };

  if (requires2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-lg border-border">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the code from your {twoFactorMethod === 'totp' ? 'authenticator app' : 'email'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handle2FAVerify} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="2fa-code">Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    id="2fa-code"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="^[0-9]+$"
                    value={twoFactorCode}
                    onChange={(value) => setTwoFactorCode(value.replace(/\D/g, "").slice(0, 6))}
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
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code.
                </p>
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-semibold"
                disabled={loading || twoFactorCode.length < 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setRequires2FA(false);
                setTempToken(null);
                setTwoFactorCode('');
              }}
            >
              Back to login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary mb-4 text-white font-bold text-xl">
            O
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to continue to OmniMart
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20 flex items-center justify-between gap-2">
                <span>{error}</span>
                {isBlocked && !requestSubmitted && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUnblockModal(true)}
                    className="h-7 text-xs"
                  >
                    Request Unblock
                  </Button>
                )}
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-10"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                Remember me
              </Label>
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up for free
            </Link>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={showUnblockModal} onOpenChange={setShowUnblockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Account Unblock</DialogTitle>
            <DialogDescription>
              Please provide a message explaining why your account should be unblocked. Our admin team will review your request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="unblock-title">Title</Label>
              <Input
                id="unblock-title"
                placeholder="Enter a title for your request..."
                value={unblockTitle}
                onChange={(e) => setUnblockTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unblock-message">Message</Label>
              <Textarea
                id="unblock-message"
                placeholder="Please explain why your account should be unblocked..."
                value={unblockMessage}
                onChange={(e) => setUnblockMessage(e.target.value)}
                rows={5}
                className="resize-none"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUnblockModal(false);
                setUnblockTitle('');
                setUnblockMessage('');
              }}
              disabled={submittingUnblock}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUnblockRequest}
              disabled={submittingUnblock || !unblockTitle.trim() || !unblockMessage.trim()}
            >
              {submittingUnblock ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SignIn;

