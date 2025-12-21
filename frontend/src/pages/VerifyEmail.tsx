import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verify = async () => {
      try {
        const response = await authApi.verifyEmail(token);
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to continue registration...');
        // Redirect to signup step 4 after 2 seconds
        setTimeout(() => {
          navigate(`/signup?userId=${response.userId}&step=4`);
        }, 2000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Email verification failed');
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
            O
          </div>
          <CardTitle className="text-2xl">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Verifying your email</AlertTitle>
              <AlertDescription>
                Please wait while we verify your email address…
              </AlertDescription>
            </Alert>
          )}

          {status === 'success' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Email verified!</AlertTitle>
              <AlertDescription className="space-y-2">
                <div className="text-muted-foreground">{message}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting…
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Verification failed</AlertTitle>
              <AlertDescription className="space-y-4">
                <div>{message}</div>
                <Button className="w-full" onClick={() => navigate('/signup')}>
                  Go to Sign Up
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerifyEmail;

