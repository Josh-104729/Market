import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { authApi, referralApi } from '../services/api';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';

function SignUp() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Email, Password
  const [step1Data, setStep1Data] = useState({
    email: '',
    password: '',
    repassword: '',
  });

  // Step 4: User Info
  const [step4Data, setStep4Data] = useState({
    userName: '',
    firstName: '',
    lastName: '',
    middleName: '',
  });

  // Step 5: Address
  const [step5Data, setStep5Data] = useState({
    country: '',
  });

  // Step 6: Phone
  const [step6Data, setStep6Data] = useState({
    phoneNumber: '',
  });

  // Step 7: Phone Verification
  const [step7Data, setStep7Data] = useState({
    verificationCode: '',
  });

  // Referral code validation
  const [referralCode, setReferralCode] = useState('');
  const [referralCodeValidating, setReferralCodeValidating] = useState(false);
  const [referralCodeValid, setReferralCodeValid] = useState<boolean | null>(null);
  const [referrerInfo, setReferrerInfo] = useState<{
    userName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  } | null>(null);

  // Check if coming from email verification
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

  // Validate referral code with debounce
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
    }, 500); // 500ms debounce

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
      setCurrentStep(6);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  const handleStep6 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError('');
    setLoading(true);

    try {
      await authApi.signUpStep6(userId, step6Data);
      setCurrentStep(7);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleStep7 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError('');
    setLoading(true);

    try {
      const response = await authApi.signUpStep7(userId, step7Data);
      dispatch(setCredentials({ user: response.user, accessToken: response.accessToken }));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <form onSubmit={handleStep1} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Create Your Account</h2>
              <p className="text-gray-400">Start your journey with us</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter your email"
                value={step1Data.email}
                onChange={(e) =>
                  setStep1Data({ ...step1Data, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Create a password (min. 8 characters)"
                value={step1Data.password}
                onChange={(e) =>
                  setStep1Data({ ...step1Data, password: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="Confirm your password"
                value={step1Data.repassword}
                onChange={(e) =>
                  setStep1Data({ ...step1Data, repassword: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Referral Code <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  className={`w-full px-4 py-3 border rounded-lg bg-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase ${
                    referralCodeValid === true
                      ? 'border-green-500'
                      : referralCodeValid === false
                      ? 'border-red-500'
                      : 'border-gray-600'
                  }`}
                  placeholder="Enter referral code (optional)"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={12}
                />
                {referralCodeValidating && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!referralCodeValidating && referralCodeValid === true && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {!referralCodeValidating && referralCodeValid === false && referralCode.length >= 8 && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
              {referralCodeValid === true && referrerInfo && (
                <div className="mt-2 p-3 bg-green-900/30 border border-green-500/50 rounded-lg">
                  <p className="text-sm text-green-400">
                    ✓ Valid code! You're being referred by{' '}
                    <span className="font-semibold">
                      {referrerInfo.firstName && referrerInfo.lastName
                        ? `${referrerInfo.firstName} ${referrerInfo.lastName}`
                        : referrerInfo.userName || 'a user'}
                    </span>
                  </p>
                </div>
              )}
              {referralCodeValid === false && referralCode.length >= 8 && (
                <p className="mt-2 text-sm text-red-400">Invalid referral code</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Processing...' : 'Continue'}
            </button>
          </form>
        );

      case 2:
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Check Your Email</h2>
            <p className="text-gray-400 mb-2">
              We've sent a verification link to
            </p>
            <p className="text-blue-400 font-semibold mb-6">{step1Data.email}</p>
            <p className="text-gray-400 text-sm mb-4">
              Please check your email and click the verification link to continue.
            </p>
            <p className="text-gray-400 text-xs">
              Didn't receive the email? Check your spam folder.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Email Verified!</h2>
            <p className="text-gray-400 mb-6">
              Your email has been verified successfully!
            </p>
            <button
              onClick={() => setCurrentStep(4)}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              Continue to Profile Setup
            </button>
          </div>
        );

      case 4:
        return (
          <form onSubmit={handleStep4} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Personal Information</h2>
              <p className="text-gray-400">Tell us about yourself</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Username *
              </label>
              <input
                type="text"
                required
                minLength={3}
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={step4Data.userName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, userName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                First Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={step4Data.firstName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, firstName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={step4Data.lastName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, lastName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Middle Name (Optional)
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={step4Data.middleName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, middleName: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        );

      case 5:
        return (
          <form onSubmit={handleStep5} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">Step 5: Country</h2>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Country *
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={step5Data.country}
                onChange={(e) =>
                  setStep5Data({ ...step5Data, country: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        );

      case 6:
        return (
          <form onSubmit={handleStep6} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Phone Verification</h2>
              <p className="text-gray-400">We'll send you a verification code</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Phone Number *
              </label>
              <div className="phone-input-wrapper">
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={step6Data.phoneNumber}
                  onChange={(value) =>
                    setStep6Data({ ...step6Data, phoneNumber: value || '' })
                  }
                  className="phone-input-modern"
                />
              </div>
              <style>{`
                .phone-input-wrapper {
                  border: 1px solid #d1d5db;
                  border-radius: 0.5rem;
                  padding: 0.25rem;
                  transition: all 0.2s;
                }
                .phone-input-wrapper:focus-within {
                  border-color: #3b82f6;
                  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .phone-input-modern .PhoneInputInput {
                  width: 100%;
                  padding: 0.75rem 1rem;
                  border: none;
                  background-color: #374151;
                  color: #f3f4f6;
                  border-radius: 0.375rem;
                  font-size: 1rem;
                  outline: none;
                }
                .phone-input-modern .PhoneInputInput::placeholder {
                  color: #9ca3af;
                }
                .phone-input-modern .PhoneInputInput:focus {
                  outline: none;
                }
                .phone-input-modern .PhoneInputCountry {
                  padding: 0.75rem 0.5rem;
                  border-right: 1px solid #e5e7eb;
                  margin-right: 0.5rem;
                }
                .phone-input-modern .PhoneInputCountryIcon {
                  width: 1.5rem;
                  height: 1.5rem;
                  box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
                }
                .phone-input-modern .PhoneInputCountrySelect {
                  font-size: 0.875rem;
                  color: #f3f4f6;
                  background: transparent;
                  border: none;
                  padding: 0.25rem;
                }
              `}</style>
            </div>
            <button
              type="submit"
              disabled={loading || !step6Data.phoneNumber}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </form>
        );

      case 7:
        return (
          <form onSubmit={handleStep7} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">Step 7: Verify Phone Number</h2>
            <p className="text-gray-400 mb-4">
              We've sent a verification code to <strong>{step6Data.phoneNumber}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Verification Code *
              </label>
              <input
                type="text"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center text-2xl tracking-widest"
                placeholder="000000"
                value={step7Data.verificationCode}
                onChange={(e) =>
                  setStep7Data({
                    ...step7Data,
                    verificationCode: e.target.value.replace(/\D/g, ''),
                  })
                }
              />
            </div>
            <button
              type="submit"
              disabled={loading || step7Data.verificationCode.length !== 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? 'Verifying...' : 'Verify & Complete Registration'}
            </button>
          </form>
        );

      default:
        return null;
    }
  };

  const steps = [
    { number: 1, title: 'Account' },
    { number: 2, title: 'Verify' },
    { number: 3, title: 'Confirmed' },
    { number: 4, title: 'Profile' },
    { number: 5, title: 'Address' },
    { number: 6, title: 'Phone' },
    { number: 7, title: 'Complete' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <span className="text-blue-400 font-bold text-xl">O</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create Your Account</h2>
                <p className="text-blue-100 text-sm">Join OmniMart - Sell and buy anything</p>
              </div>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center justify-between mt-6">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                        currentStep >= step.number
                          ? 'bg-white text-blue-400'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {currentStep > step.number ? '✓' : step.number}
                    </div>
                    <span className={`text-xs mt-2 ${currentStep >= step.number ? 'text-white' : 'text-blue-200'}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 rounded ${
                        currentStep > step.number ? 'bg-white' : 'bg-white/20'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8">
            {error && (
              <div className="mb-6 bg-red-900 border-l-4 border-red-500 text-red-200 px-4 py-3 rounded">
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="min-h-[400px]">
              {renderStep()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;

