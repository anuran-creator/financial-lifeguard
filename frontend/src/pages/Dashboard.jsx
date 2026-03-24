import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { transactionAPI, budgetAPI, authAPI } from '../utils/api';
import { formatCurrency, getGreeting, formatDate } from '../utils/helpers';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, CreditCard, RefreshCw, Mail, AlertCircle } from 'lucide-react';
import Loading from '../components/Common/Loading';
import ErrorMessage from '../components/Common/ErrorMessage';

const Dashboard = () => {
  const { user, setUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Build stats params with optional account filter
      const statsParams = {
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
      };
      
      if (selectedAccount) {
        statsParams.accountNumber = selectedAccount;
      }

      const [statsRes, budgetRes, accountsRes] = await Promise.all([
        transactionAPI.getStats(statsParams),
        budgetAPI.getSummary({ period: 'monthly' }),
        transactionAPI.getAccounts(),
      ]);

      if (!signal?.aborted) {
        setStats(statsRes.data.data);
        setBudgetSummary(budgetRes.data.data);
        setAccounts(accountsRes.data.data || []);
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [selectedAccount]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchDashboardData(abortController.signal);
    
    // Handle OAuth callback token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      console.log('🔐 Found OAuth token in URL, updating authentication...');
      localStorage.setItem('token', token);
      
      // Update user data with new token
      const updateUserAfterOAuth = async () => {
        try {
          const response = await authAPI.getMe();
          const userData = response.data.data;
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log('✅ OAuth authentication completed successfully');
        } catch (error) {
          console.error('❌ Failed to update user after OAuth:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      };
      
      updateUserAfterOAuth();
    }
    
    return () => {
      abortController.abort();
    };
  }, [fetchDashboardData, setUser]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await transactionAPI.sync();
      const { newTransactions, updatedTransactions, totalProcessed } = response.data.data;
      
      let message = `Sync completed!\n`;
      if (newTransactions > 0) message += `✅ ${newTransactions} new transactions\n`;
      if (updatedTransactions > 0) message += `🔄 ${updatedTransactions} updated transactions\n`;
      message += `📊 Total: ${totalProcessed} transactions processed`;
      
      alert(message);
      // Refresh dashboard data after sync
      const abortController = new AbortController();
      fetchDashboardData(abortController.signal);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const response = await authAPI.getGoogleAuthUrl();
      window.location.href = response.data.authUrl;
    } catch (err) {
      alert('Failed to get Google auth URL');
    }
  };

  const handleRetry = () => {
    const abortController = new AbortController();
    fetchDashboardData(abortController.signal);
  };

  if (loading) return <Loading message="Loading dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={handleRetry} />;

  const COLORS = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#3b82f6', '#f97316', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}, {user?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here's your financial overview for {formatDate(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Account Filter Dropdown */}
          {accounts.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="input min-w-[200px]"
            >
              <option value="">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.accountNumber} value={account.accountNumber}>
                  {account.bankName || 'Unknown Bank'} •••• {account.accountNumber}
                </option>
              ))}
            </select>
          )}
          
          {!user?.gmailConnected ? (
            <button onClick={handleConnectGmail} className="btn btn-primary flex items-center">
              <Mail className="w-4 h-4 mr-2" />
              Connect Gmail
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn btn-primary flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Emails'}
            </button>
          )}
        </div>
      </div>

      {/* Gmail Connection Alert */}
      {!user?.gmailConnected && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-yellow-800 dark:text-yellow-300">
              Connect your Gmail account
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Connect Gmail to automatically track your transactions from email notifications
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Spending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(stats?.totalSpending || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Budget Remaining</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(budgetSummary?.totals?.remaining || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Wallet className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.categorySpending?.reduce((sum, cat) => sum + cat.count, 0) || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Budget Usage</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {budgetSummary?.totals?.percentage || 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Pie Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Spending by Category</h2>
          {stats?.categorySpending && stats.categorySpending.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.categorySpending}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.category}: ${formatCurrency(entry.total)}`}
                >
                  {stats.categorySpending.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-12">No spending data available</p>
          )}
        </div>

        {/* Daily Spending Trend Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Daily Spending (Last 30 Days)</h2>
          {stats?.dailyTrend && stats.dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={stats.dailyTrend.map(item => ({
                  ...item,
                  dateLabel: (() => {
                    const date = new Date(item._id.year, item._id.month - 1, item._id.day);
                    return `${item._id.day}/${item._id.month}`;
                  })(),
                  fullDateLabel: (() => {
                    const date = new Date(item._id.year, item._id.month - 1, item._id.day);
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[item._id.month - 1]} ${item._id.day}, ${item._id.year}`;
                  })()
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  stroke="#9ca3af"
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(1)}k`}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value), 'Spending']}
                  labelFormatter={(label, payload) => {
                    return payload && payload[0] ? payload[0].payload.fullDateLabel : label;
                  }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                />
                <Bar 
                  dataKey="total" 
                  fill="#10b981" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-12">No daily spending data available</p>
          )}
        </div>
      </div>

      {/* Monthly Trend Chart - Full Width */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Monthly Spending Trend</h2>
        {stats?.monthlyTrend && stats.monthlyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart 
              data={stats.monthlyTrend.map(item => ({
                ...item,
                monthLabel: (() => {
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return `${monthNames[item._id.month - 1]} ${item._id.year}`;
                })(),
                fullMonthLabel: (() => {
                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                     'July', 'August', 'September', 'October', 'November', 'December'];
                  return `${monthNames[item._id.month - 1]} ${item._id.year}`;
                })()
              }))}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis 
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                stroke="#9ca3af"
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value), 'Spending']}
                labelFormatter={(label, payload) => {
                  return payload && payload[0] ? payload[0].payload.fullMonthLabel : label;
                }}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
              />
              <Bar 
                dataKey="total" 
                fill="#6366f1" 
                radius={[8, 8, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500 py-12">No trend data available</p>
        )}
      </div>

      {/* Account-wise Spending & Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account-wise Spending */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Spending by Account</h2>
          {stats?.accountSpending && stats.accountSpending.length > 0 ? (
            <div className="space-y-3">
              {stats.accountSpending.map((account, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-medium mr-3">
                      {account.accountNumber}
                    </div>
                    <div>
                      <p className="font-medium">{account.bankName || 'Unknown Bank'}</p>
                      <p className="text-sm text-gray-500">
                        {account.accountName || `A/c ${account.accountNumber}`} • {account.count} transactions
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatCurrency(account.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">No account data available</p>
          )}
        </div>

        {/* Top Merchants */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Top Merchants</h2>
          {stats?.topMerchants && stats.topMerchants.length > 0 ? (
            <div className="space-y-3">
              {stats.topMerchants.slice(0, 5).map((merchant, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 font-medium mr-3">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{merchant._id}</p>
                      <p className="text-sm text-gray-500">{merchant.count} transactions</p>
                    </div>
                  </div>
                  <p className="font-semibold">{formatCurrency(merchant.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">No merchant data available</p>
          )}
        </div>

        {/* Budget Progress */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Budget Progress</h2>
          {budgetSummary?.budgets && budgetSummary.budgets.length > 0 ? (
            <div className="space-y-4">
              {budgetSummary.budgets.slice(0, 5).map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{item.budget.category.icon}</span>
                      <span className="font-medium">{item.budget.category.name}</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(item.spent)} / {formatCurrency(item.budget.amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.percentage >= 100
                          ? 'bg-red-600'
                          : item.percentage >= 80
                          ? 'bg-orange-600'
                          : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.percentage.toFixed(1)}% used</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-12">No budgets set</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
