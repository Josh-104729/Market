import { useState } from 'react';
import { showToast } from '../utils/toast';

interface ReferralCodeProps {
  code: string;
}

function ReferralCode({ code }: ReferralCodeProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      showToast.success('Referral code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast.error('Failed to copy code');
    }
  };

  return (
    <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
      <h3 className="text-lg font-semibold text-neutral-100 mb-4">Your Referral Code</h3>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-neutral-900 px-4 py-3 rounded-lg border border-neutral-700">
          <code className="text-2xl font-bold text-blue-400 tracking-wider">{code}</code>
        </div>
        <button
          onClick={copyToClipboard}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
        >
          {copied ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <p className="text-sm text-neutral-400 mt-4">
        Share this code with friends! When they sign up using your code, you'll earn rewards.
      </p>
    </div>
  );
}

export default ReferralCode;

