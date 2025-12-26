import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let lastToken: string | null = null;

// Base Socket.IO URL (no `/chat`). Prefer env var; fallback keeps previous behavior.
const SOCKET_BASE_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : `${window.location.protocol}//${window.location.host}`);

export const getSocket = (): Socket | null => {
  const token = localStorage.getItem('adminAccessToken');
  
  if (!token) {
    console.warn('No admin access token found, cannot connect to chat server');
    return null;
  }

  // If token changed (re-login), recreate socket so auth uses the latest token.
  if (lastToken && lastToken !== token) {
    disconnectSocket();
  }
  lastToken = token;

  if (!socket || !socket.connected) {
    const socketUrl = `${SOCKET_BASE_URL}/chat`;
    
    console.log('Connecting to Socket.IO server:', socketUrl);
    
    socket = io(socketUrl, {
      auth: {
        token: token,
      },
      query: {
        token: token,
      },
      transports: ['polling', 'websocket'],
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
        window.dispatchEvent(new CustomEvent('auth-expired', { detail: { reason } }));
        disconnectSocket();
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      if (reason === 'io server disconnect') {
        socket?.connect();
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

