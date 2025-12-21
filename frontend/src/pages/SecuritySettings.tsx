import { useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { showToast } from '../utils/toast';

function SecuritySettings() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'backup'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    load2FAStatus();
  }, []);

  const load2FAStatus = async () => {
    try {
      const status = await authApi.twoFactor.getStatus();
      setTwoFactorEnabled(status.enabled);
      setTwoFactorMethod(status.method);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    try {
      const result = await authApi.twoFactor.enable('totp');
      setQrCodeUrl(result.qrCodeUrl);
      setSetupStep('qr');
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authApi.twoFactor.verifySetup(verificationCode);
      setBackupCodes(result.backupCodes || []);
      setSetupStep('backup');
      setShowBackupCodes(true);
      showToast.success('2FA enabled successfully!');
      await load2FAStatus();
      // Dispatch event to notify Layout component
      window.dispatchEvent(new CustomEvent('2fa-status-updated'));
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await authApi.twoFactor.disable(password);
      showToast.success('2FA disabled successfully');
      setTwoFactorEnabled(false);
      setTwoFactorMethod(null);
      setPassword('');
      setSetupStep('idle');
      // Dispatch event to notify Layout component
      window.dispatchEvent(new CustomEvent('2fa-status-updated'));
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.twoFactor.regenerateBackupCodes(password);
      setBackupCodes(result.backupCodes || []);
      setShowBackupCodes(true);
      setPassword('');
      showToast.success('Backup codes regenerated');
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8">Security Settings</h1>

      <div className="glass-card rounded-xl p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Two-Factor Authentication</h2>
        
        {!twoFactorEnabled ? (
          <div>
            <p className="text-neutral-400 mb-4">
              Add an extra layer of security to your account by enabling two-factor authentication.
            </p>
            
            {setupStep === 'idle' && (
              <button
                onClick={handleEnable2FA}
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {loading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            )}

            {setupStep === 'qr' && (
              <div className="space-y-4">
                <p className="text-neutral-300">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                <div className="flex justify-center">
                  <img src={qrCodeUrl} alt="QR Code" className="bg-white p-4 rounded-lg" />
                </div>
                <form onSubmit={handleVerifySetup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Enter verification code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      className="w-full px-4 py-3 glass-card rounded-xl text-white text-center text-2xl tracking-widest"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </form>
              </div>
            )}

            {setupStep === 'backup' && showBackupCodes && (
              <div className="space-y-4">
                <div className="bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-200 px-4 py-3 rounded">
                  <p className="font-medium mb-2">Important: Save these backup codes</p>
                  <p className="text-sm">These codes can be used to access your account if you lose your authenticator device. Store them in a safe place.</p>
                </div>
                <div className="bg-neutral-800 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="font-mono text-center p-2 bg-neutral-700 rounded text-white">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSetupStep('idle');
                    setShowBackupCodes(false);
                    setBackupCodes([]);
                  }}
                  className="w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all"
                >
                  I've saved my backup codes
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-green-400 font-semibold">2FA is enabled</p>
                <p className="text-neutral-400 text-sm">Method: {twoFactorMethod?.toUpperCase()}</p>
              </div>
            </div>
            
            <form onSubmit={handleDisable2FA} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Enter your password to disable 2FA
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-3 glass-card rounded-xl text-white"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {loading ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </form>

            <div className="border-t border-neutral-700 pt-4">
              <h3 className="text-lg font-semibold text-white mb-2">Backup Codes</h3>
              <p className="text-neutral-400 text-sm mb-4">
                Regenerate backup codes if you've used them all or need new ones.
              </p>
              <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Enter your password to regenerate backup codes
                  </label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-3 glass-card rounded-xl text-white"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Regenerating...' : 'Regenerate Backup Codes'}
                </button>
              </form>
              {showBackupCodes && backupCodes.length > 0 && (
                <div className="mt-4 space-y-4">
                  <div className="bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-200 px-4 py-3 rounded">
                    <p className="font-medium mb-2">New Backup Codes Generated</p>
                    <p className="text-sm">Save these codes in a safe place. They won't be shown again.</p>
                  </div>
                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((code, index) => (
                        <div key={index} className="font-mono text-center p-2 bg-neutral-700 rounded text-white">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowBackupCodes(false);
                      setBackupCodes([]);
                    }}
                    className="w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all"
                  >
                    I've saved my backup codes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SecuritySettings;

