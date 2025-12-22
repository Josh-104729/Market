import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi, referralApi } from '../services/api';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Check, 
  X,
  Mail, 
  Lock, 
  User, 
  Globe, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  UserCheck
} from "lucide-react";

function SignUp() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [step1Data, setStep1Data] = useState({
    email: '',
    password: '',
    repassword: '',
  });

  const [step4Data, setStep4Data] = useState({
    userName: '',
    firstName: '',
    lastName: '',
    middleName: '',
  });

  const [step5Data, setStep5Data] = useState({
    country: '',
  });

  const [referralCode, setReferralCode] = useState('');
  const [referralCodeValidating, setReferralCodeValidating] = useState(false);
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null);
  const [referrerInfo, setReferrerInfo] = useState<{
    userName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userIdParam = searchParams.get('userId');
    const stepParam = searchParams.get('step');

    if (token) {
      handleEmailVerification(token);
    } else if (userIdParam && stepParam) {
      setUserId(userIdParam);
      setCurrentStep(parseInt(stepParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!referralCode || referralCode.trim().length < 8) {
      setReferralCodeValid(null);
      setReferrerInfo(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setReferralCodeValidating(true);
      try {
        const result = await referralApi.validateCode(referralCode.trim().toUpperCase());
        setReferralCodeValid(result.isValid);
        if (result.isValid && result.referrer) {
          setReferrerInfo(result.referrer);
        } else {
          setReferrerInfo(null);
        }
      } catch (error) {
        setReferralCodeValid(false);
        setReferrerInfo(null);
      } finally {
        setReferralCodeValidating(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [referralCode]);

  const handleEmailVerification = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await authApi.verifyEmail(token);
      setUserId(response.userId);
      setCurrentStep(4);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (step1Data.password !== step1Data.repassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const signupData = {
        ...step1Data,
        referralCode: referralCode.trim() || undefined,
      };
      const response = await authApi.signUpStep1(signupData);
      setUserId(response.userId);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError('');
    setLoading(true);

    try {
      await authApi.signUpStep4(userId, step4Data);
      setCurrentStep(5);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save user information');
    } finally {
      setLoading(false);
    }
  };

  const handleStep5 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError('');
    setLoading(true);

    try {
      await authApi.signUpStep5(userId, step5Data);
      const response = await authApi.signUpStep7(userId, { verificationCode: '000000' });
      dispatch(setCredentials({ user: response.user, accessToken: response.accessToken }));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Account', icon: Lock },
    { number: 2, title: 'Verify', icon: Mail },
    { number: 3, title: 'Confirmed', icon: CheckCircle2 },
    { number: 4, title: 'Profile', icon: User },
    { number: 5, title: 'Complete', icon: Globe },
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="pl-10"
                  value={step1Data.email}
                  onChange={(e) => setStep1Data({ ...step1Data, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Create a password"
                  className="pl-10"
                  value={step1Data.password}
                  onChange={(e) => setStep1Data({ ...step1Data, password: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="repassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="repassword"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Confirm your password"
                  className="pl-10"
                  value={step1Data.repassword}
                  onChange={(e) => setStep1Data({ ...step1Data, repassword: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral">Referral Code (Optional)</Label>
              <div className="relative">
                <Input
                  id="referral"
                  type="text"
                  placeholder="ENTER CODE"
                  className={`uppercase pr-10 ${
                    referralCodeValid === true ? 'border-green-500' : 
                    referralCodeValid === false ? 'border-destructive' : ''
                  }`}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={12}
                />
                <div className="absolute right-3 top-3">
                  {referralCodeValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : referralCodeValid === true ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : referralCodeValid === false && referralCode.length >= 8 ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
              </div>
              {referralCodeValid === true && referrerInfo && (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-100 rounded-md">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium">
                    Referred by {referrerInfo.firstName || referrerInfo.userName}
                  </span>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Continue'}
            </Button>
          </form>
        );

      case 2:
        return (
          <div className="text-center py-6 space-y-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Check Your Email</h3>
              <p className="text-muted-foreground text-sm">
                We've sent a verification link to <span className="font-semibold text-foreground">{step1Data.email}</span>
              </p>
            </div>
            <Card className="bg-muted/40 border-border">
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Please check your inbox (and spam folder) and click the link to continue your registration.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="text-center py-6 space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Email Verified!</h3>
              <p className="text-muted-foreground text-sm">Your identity has been confirmed successfully.</p>
            </div>
            <Button onClick={() => setCurrentStep(4)} className="w-full h-11 text-base font-semibold">
              Continue to Profile Setup <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );

      case 4:
        return (
          <form onSubmit={handleStep4} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                required
                minLength={3}
                placeholder="Choose a public name"
                value={step4Data.userName}
                onChange={(e) => setStep4Data({ ...step4Data, userName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  required
                  placeholder="John"
                  value={step4Data.firstName}
                  onChange={(e) => setStep4Data({ ...step4Data, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  required
                  placeholder="Doe"
                  value={step4Data.lastName}
                  onChange={(e) => setStep4Data({ ...step4Data, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name (Optional)</Label>
              <Input
                id="middleName"
                placeholder="Middle name"
                value={step4Data.middleName}
                onChange={(e) => setStep4Data({ ...step4Data, middleName: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Continue'}
            </Button>
          </form>
        );

      case 5:
        return (
          <form onSubmit={handleStep5} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="country"
                  required
                  placeholder="Enter your country"
                  className="pl-10"
                  value={step5Data.country}
                  onChange={(e) => setStep5Data({ ...step5Data, country: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Complete Registration'}
            </Button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <Card className="w-full max-w-lg shadow-xl border-border overflow-hidden">
        <div className="bg-card px-8 py-8 text-foreground relative border-b border-border">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="font-bold text-xl text-primary-foreground">O</span>
              </div>
              <div>
                <CardTitle className="text-2xl">Create Account</CardTitle>
                <CardDescription className="text-muted-foreground">Join OmniMart marketplace</CardDescription>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 relative">
              <div className="absolute top-4 left-0 w-full h-0.5 bg-border -z-0" />
              {steps.map((step) => (
                <div key={step.number} className="relative z-10 flex flex-col items-center gap-2 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      currentStep >= step.number
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border'
                    }`}
                  >
                    {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <CardContent className="p-8">
          {error && (
            <div className="mb-6 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20 flex items-center gap-2">
              <X className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="min-h-[300px]">
            {renderStep()}
          </div>
        </CardContent>

        <CardFooter className="bg-muted/40 border-t border-border flex flex-col p-6">
          <div className="mb-4 text-xs text-center text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </div>
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="font-bold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default SignUp;
