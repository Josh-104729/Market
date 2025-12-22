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
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      forceNew: false,
      withCredentials: true,
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('✅ Connected to chat server');
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
        if (tokenNow) socket?.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      if (String(error?.message || '').toLowerCase().includes('jwt expired')) {
        window.dispatchEvent(new CustomEvent('auth-expired', { detail: { reason: 'jwt_expired' } }));
        disconnectSocket();
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
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

