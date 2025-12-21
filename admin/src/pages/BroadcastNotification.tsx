import { useState } from 'react';
import { notificationApi } from '../services/api';
import { showToast } from '../utils/toast';

function BroadcastNotification() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      showToast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await notificationApi.broadcast({
        title: title.trim(),
        message: message.trim(),
      });
      showToast.success('Notification broadcasted successfully');
      setTitle('');
      setMessage('');
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Failed to broadcast notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Broadcast Notification</h1>
        
        <div className="glass-card p-6 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-neutral-300 mb-2">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter notification title"
                required
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-neutral-300 mb-2">
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Enter notification message"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Broadcasting...' : 'Broadcast to All Users'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default BroadcastNotification;

