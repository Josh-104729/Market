import { useState, useEffect } from 'react';
import { referralApi, ReferralStats, ReferralListItem, RewardListItem } from '../services/api';
import ReferralCode from '../components/ReferralCode';
import { showToast } from '../utils/toast';

function Referral() {
  const [loading, setLoading] = useState(true);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralListItem[]>([]);
  const [rewards, setRewards] = useState<RewardListItem[]>([]);
  const [activeTab, setActiveTab] = useState<'referrals' | 'rewards'>('referrals');
  const [referralsPage, setReferralsPage] = useState(1);
  const [rewardsPage, setRewardsPage] = useState(1);
  const [referralsTotalPages, setReferralsTotalPages] = useState(1);
  const [rewardsTotalPages, setRewardsTotalPages] = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Skip on initial mount - loadData already loads referrals
    if (initialLoad) {
      setInitialLoad(false);
      return;
    }

    // Load data when tab or page changes
    if (activeTab === 'referrals') {
      loadReferrals();
    } else {
      loadRewards();
    }
  }, [activeTab, referralsPage, rewardsPage]);

  const loadData = async () => {
    try {
      const [statsData, referralsData] = await Promise.all([
        referralApi.getMyStats(),
        referralApi.getMyReferrals({ page: 1, limit: 10 }),
      ]);
      setStats(statsData);
      setReferrals(referralsData.referrals);
      setReferralsTotalPages(referralsData.totalPages);
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const loadReferrals = async () => {
    setLoadingReferrals(true);
    try {
      const data = await referralApi.getMyReferrals({ page: referralsPage, limit: 10 });
      setReferrals(data.referrals || []);
      setReferralsTotalPages(data.totalPages || 1);
    } catch (error: any) {
      console.error('Failed to load referrals:', error);
      showToast.error(error.response?.data?.message || 'Failed to load referrals');
      setReferrals([]);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const loadRewards = async () => {
    setLoadingRewards(true);
    try {
      const data = await referralApi.getRewards({ page: rewardsPage, limit: 10 });
      setRewards(data.rewards || []);
      setRewardsTotalPages(data.totalPages || 1);
    } catch (error: any) {
      console.error('Failed to load rewards:', error);
      showToast.error(error.response?.data?.message || 'Failed to load rewards');
      setRewards([]);
    } finally {
      setLoadingRewards(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pending', className: 'bg-yellow-900 text-yellow-300' },
      active: { label: 'Active', className: 'bg-blue-900 text-blue-300' },
      completed: { label: 'Completed', className: 'bg-green-900 text-green-300' },
      expired: { label: 'Expired', className: 'bg-gray-700 text-gray-300' },
    };

    const config = statusConfig[status.toLowerCase()] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getRewardTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      signup_bonus: 'Signup Bonus',
      first_purchase: 'First Purchase',
      milestone: 'Milestone',
      custom: 'Custom',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-100 mb-6">Referral Program</h1>

        {stats ? (
          <>
            {/* Referral Code */}
            <div className="mb-6">
              <ReferralCode code={stats.referralCode} />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Total Referrals</p>
                <p className="text-3xl font-bold text-gray-100">{stats.totalReferrals}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Active Referrals</p>
                <p className="text-3xl font-bold text-blue-400">{stats.activeReferrals}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Completed</p>
                <p className="text-3xl font-bold text-green-400">{stats.completedReferrals}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">Total Earnings</p>
                <p className="text-3xl font-bold text-purple-400">
                  {stats.totalEarnings.toFixed(2)} USDT
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <p className="text-gray-400">Loading referral code...</p>
            </div>
          </div>
        )}

        {/* Tabs - Always visible */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="border-b border-gray-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('referrals')}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'referrals'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                My Referrals {stats && `(${stats.totalReferrals})`}
              </button>
              <button
                onClick={() => setActiveTab('rewards')}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'rewards'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Reward History
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'referrals' ? (
              <div>
                {loadingReferrals ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-400 mt-4">Loading referrals...</p>
                  </div>
                ) : referrals.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No referrals yet. Start sharing your code!</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {referrals.map((referral) => (
                        <div
                          key={referral.id}
                          className="bg-gray-900 rounded-lg p-4 border border-gray-700 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                              {referral.referredUser.avatar ? (
                                <img
                                  src={referral.referredUser.avatar}
                                  alt={referral.referredUser.userName || 'User'}
                                  className="w-12 h-12 rounded-full"
                                />
                              ) : (
                                <span className="text-gray-400 font-semibold">
                                  {referral.referredUser.firstName?.[0] ||
                                    referral.referredUser.userName?.[0] ||
                                    'U'}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-gray-100 font-semibold">
                                {referral.referredUser.firstName && referral.referredUser.lastName
                                  ? `${referral.referredUser.firstName} ${referral.referredUser.lastName}`
                                  : referral.referredUser.userName || referral.referredUser.email}
                              </p>
                              <p className="text-gray-400 text-sm">
                                {new Date(referral.referredAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {getStatusBadge(referral.status)}
                            <div className="text-right">
                              <p className="text-gray-400 text-sm">Earnings</p>
                              <p className="text-green-400 font-semibold">
                                {referral.earnings.toFixed(2)} USDT
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {referralsTotalPages > 1 && (
                      <div className="flex justify-center gap-2 mt-6">
                        <button
                          onClick={() => setReferralsPage((p) => Math.max(1, p - 1))}
                          disabled={referralsPage === 1}
                          className="px-4 py-2 bg-gray-700 text-gray-300 rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-4 py-2 text-gray-400">
                          Page {referralsPage} of {referralsTotalPages}
                        </span>
                        <button
                          onClick={() =>
                            setReferralsPage((p) => Math.min(referralsTotalPages, p + 1))
                          }
                          disabled={referralsPage === referralsTotalPages}
                          className="px-4 py-2 bg-gray-700 text-gray-300 rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div>
                {loadingRewards ? (
                  <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-400 mt-4">Loading rewards...</p>
                  </div>
                ) : rewards.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No rewards yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-gray-100 font-semibold">
                                {getRewardTypeLabel(reward.rewardType)}
                              </p>
                              <p className="text-gray-400 text-sm">
                                {reward.referredUser.firstName && reward.referredUser.lastName
                                  ? `${reward.referredUser.firstName} ${reward.referredUser.lastName}`
                                  : reward.referredUser.userName || 'User'}
                              </p>
                              {reward.description && (
                                <p className="text-gray-500 text-xs mt-1">{reward.description}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-green-400 font-bold text-lg">
                                +{reward.amount.toFixed(2)} {reward.currency}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {reward.processedAt
                                  ? new Date(reward.processedAt).toLocaleDateString()
                                  : 'Pending'}
                              </p>
                              {reward.status === 'processed' && (
                                <span className="inline-block mt-1 px-2 py-1 bg-green-900 text-green-300 rounded text-xs">
                                  Processed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {rewardsTotalPages > 1 && (
                      <div className="flex justify-center gap-2 mt-6">
                        <button
                          onClick={() => setRewardsPage((p) => Math.max(1, p - 1))}
                          disabled={rewardsPage === 1}
                          className="px-4 py-2 bg-gray-700 text-gray-300 rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-4 py-2 text-gray-400">
                          Page {rewardsPage} of {rewardsTotalPages}
                        </span>
                        <button
                          onClick={() =>
                            setRewardsPage((p) => Math.min(rewardsTotalPages, p + 1))
                          }
                          disabled={rewardsPage === rewardsTotalPages}
                          className="px-4 py-2 bg-gray-700 text-gray-300 rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Referral;

