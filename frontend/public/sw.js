// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // If data is not JSON, use as text
    data = { body: event.data ? event.data.text() : 'You have a new message' };
  }
  
  const title = data.title || 'New Message';
  const options = {
    body: data.body || data.message || 'You have a new message',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || data.data?.conversationId ? `chat-${data.data.conversationId}` : 'chat-message',
    data: data.data || {},
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || event.notification.data?.conversationId 
    ? `/chat/${event.notification.data.conversationId}` 
    : '/chat';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          // Focus existing window and navigate to the chat
          return client.focus().then(() => {
            // Send message to client to navigate
            if (client.navigate) {
              return client.navigate(urlToOpen);
            }
            return client;
          });
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  // Optional: Track notification dismissal
  console.log('Notification closed:', event.notification.tag);
});

