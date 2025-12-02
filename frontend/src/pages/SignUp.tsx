import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { authApi } from '../services/api';

function SignUp() {
  const navigate = useNavigate();
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
    street: '',
    city: '',
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
      const response = await authApi.signUpStep1(step1Data);
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
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));
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
          <form onSubmit={handleStep1} className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Step 1: Create Account</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step1Data.email}
                onChange={(e) =>
                  setStep1Data({ ...step1Data, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step1Data.password}
                onChange={(e) =>
                  setStep1Data({ ...step1Data, password: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step1Data.repassword}
                onChange={(e) =>
                  setStep1Data({ ...step1Data, repassword: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Continue'}
            </button>
          </form>
        );

      case 2:
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Step 2: Verify Your Email</h2>
            <p className="text-gray-300 mb-4">
              We've sent a verification link to <strong>{step1Data.email}</strong>
            </p>
            <p className="text-gray-400 text-sm">
              Please check your email and click the verification link to continue.
            </p>
            <p className="text-gray-400 text-sm mt-4">
              If you didn't receive the email, check your spam folder.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Step 3: Email Verified</h2>
            <p className="text-gray-300 mb-4">
              Your email has been verified successfully!
            </p>
            <button
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Continue to Next Step
            </button>
          </div>
        );

      case 4:
        return (
          <form onSubmit={handleStep4} className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Step 4: Personal Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                minLength={3}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step4Data.userName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, userName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step4Data.firstName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, firstName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step4Data.lastName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, lastName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Middle Name (Optional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step4Data.middleName}
                onChange={(e) =>
                  setStep4Data({ ...step4Data, middleName: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        );

      case 5:
        return (
          <form onSubmit={handleStep5} className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Step 5: Address</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Street *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step5Data.street}
                onChange={(e) =>
                  setStep5Data({ ...step5Data, street: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                City *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step5Data.city}
                onChange={(e) =>
                  setStep5Data({ ...step5Data, city: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Country *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500"
                value={step5Data.country}
                onChange={(e) =>
                  setStep5Data({ ...step5Data, country: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        );

      case 6:
        return (
          <form onSubmit={handleStep6} className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Step 6: Phone Number</h2>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Phone Number *
              </label>
              <PhoneInput
                international
                defaultCountry="US"
                value={step6Data.phoneNumber}
                onChange={(value) =>
                  setStep6Data({ ...step6Data, phoneNumber: value || '' })
                }
                className="phone-input"
                style={{
                  '--PhoneInput-color--focus': '#6366f1',
                }}
              />
              <style>{`
                .phone-input input {
                  width: 100%;
                  padding: 0.5rem 0.75rem;
                  border: 1px solid #374151;
                  background-color: #1f2937;
                  color: white;
                  border-radius: 0.375rem;
                }
                .phone-input input:focus {
                  outline: none;
                  ring: 2px;
                  ring-color: #6366f1;
                  border-color: #6366f1;
                }
                .PhoneInputInput {
                  background-color: #1f2937 !important;
                  color: white !important;
                }
              `}</style>
            </div>
            <button
              type="submit"
              disabled={loading || !step6Data.phoneNumber}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </form>
        );

      case 7:
        return (
          <form onSubmit={handleStep7} className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Step 7: Verify Phone Number</h2>
            <p className="text-gray-300 mb-4">
              We've sent a verification code to <strong>{step6Data.phoneNumber}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Verification Code *
              </label>
              <input
                type="text"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-indigo-500 text-center text-2xl tracking-widest"
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
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Complete Registration'}
            </button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Create your account
          </h2>
          <div className="mt-4 flex justify-center">
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                <div
                  key={step}
                  className={`h-2 w-2 rounded-full ${
                    step <= currentStep
                      ? 'bg-indigo-600'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6">{renderStep()}</div>
      </div>
    </div>
  );
}

export default SignUp;

