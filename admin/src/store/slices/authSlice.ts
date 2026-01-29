import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('adminAccessToken'),
  isAuthenticated: !!localStorage.getItem('adminAccessToken'),
};

// Load user from localStorage if token exists
if (initialState.accessToken) {
  const storedUser = localStorage.getItem('adminUser');
  if (storedUser) {
    try {
      initialState.user = JSON.parse(storedUser);
    } catch (e) {
      console.error('Failed to parse stored user data');
    }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; accessToken: string }>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      localStorage.setItem('adminAccessToken', action.payload.accessToken);
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('adminUser', JSON.stringify(state.user));
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminUser');
    },
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;

