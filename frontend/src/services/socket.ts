import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let lastToken: string | null = null;

// Get socket URL from environment variable
const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const getSocket = (): Socket | null => {
  const token = localStorage.getItem('accessToken');
  
  if (!token) {
    console.warn('No access token found, cannot connect to chat server');
    return null;
  }

  // If token changed (re-login), recreate socket so auth uses the latest token.
  if (lastToken && lastToken !== token) {
    disconnectSocket();
  }
  lastToken = token;

  if (!socket || !socket.connected) {
    // Use environment variable for socket URL with /chat namespace
    const socketUrl = `${SOCKET_BASE_URL}/chat`;
    
    console.log('Connecting to Socket.IO server:', socketUrl);
    
    socket = io(socketUrl, {
      auth: {
        token: token,
      },
      query: {
        token: token, // Also send as query parameter as fallback
      },
      transports: ['websocket', 'polling'], // Try websocket first for better performance, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity, // Keep trying to reconnect
      timeout: 20000, // Increase timeout for production
      forceNew: false,
      withCredentials: true,
      autoConnect: true,
      upgrade: true, // Allow transport upgrade
    });

    socket.on('connect', () => {
      console.log('✅ Connected to chat server');
      // Update token reference on successful connection
      const currentToken = localStorage.getItem('accessToken');
      if (currentToken) {
        lastToken = currentToken;
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected to chat server after ${attemptNumber} attempts`);
      // Update token reference on reconnect to ensure we use the latest token
      const currentToken = localStorage.getItem('accessToken');
      if (currentToken) {
        lastToken = currentToken;
        // Update auth for future operations
        if (socket) {
          socket.auth = { token: currentToken };
        }
      }
    });

    socket.on('auth_error', (payload: any) => {
      const reason = payload?.reason;
      console.warn('Socket auth_error:', reason);
      if (reason === 'jwt_expired' || reason === 'invalid_token') {
        // Tell the app shell to logout and redirect.
        window.dispatchEvent(new CustomEvent('auth-expired', { detail: { reason } }));
        disconnectSocket();
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, need to reconnect manually
        // Avoid endless reconnect loop on auth failures.
        const tokenNow = localStorage.getItem('accessToken');
        if (tokenNow && socket) {
          // Update auth with latest token before reconnecting
          socket.auth = { token: tokenNow };
          socket.connect();
        }
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      if (String(error?.message || '').toLowerCase().includes('jwt expired')) {
        window.dispatchEvent(new CustomEvent('auth-expired', { detail: { reason: 'jwt_expired' } }));
        disconnectSocket();
      }
    });

    socket.on('error', (error: any) => {
      console.error('❌ Socket error:', error);
      // Handle "Not authenticated" errors by attempting reconnection with fresh token
      if (error?.message && String(error.message).toLowerCase().includes('not authenticated')) {
        const currentToken = localStorage.getItem('accessToken');
        if (currentToken && socket) {
          console.log('Attempting to re-authenticate socket with fresh token...');
          // Update auth and reconnect
          socket.auth = { token: currentToken };
          socket.disconnect();
          setTimeout(() => {
            if (socket) {
              socket.connect();
            }
          }, 1000);
        } else {
          // No token available, trigger auth expiry
          window.dispatchEvent(new CustomEvent('auth-expired', { detail: { reason: 'missing_token' } }));
        }
      }
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastToken = null;
};

export const reconnectSocket = () => {
  disconnectSocket();
  return getSocket();
};

