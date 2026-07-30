import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../services/authApi';

export const loginUser = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data } = await authApi.login(email, password);
    return data.data; // { user, accessToken }
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const fetchCurrentUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.me();
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Not authenticated');
  }
});

export const restoreSession = createAsyncThunk('auth/restoreSession', async (_, { dispatch }) => {
  await dispatch(fetchCurrentUser());
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authApi.logout();
});

const initialState = {
  user: null,
  accessToken: null,
  status: 'idle', // idle | loading | succeeded | failed
  // FIX: previously a single shared `error` field was written by BOTH
  // loginUser.rejected AND fetchCurrentUser.rejected. Since restoreSession()
  // (which calls fetchCurrentUser) runs unconditionally on every app load —
  // including landing directly on /login with no session cookie yet — the
  // backend's expected "No refresh token provided." 401 from the silent-
  // refresh attempt was landing in this shared field and getting rendered
  // on the Login page as if the user had just failed to log in.
  //
  // `loginError` is now written ONLY by loginUser, and is the only field
  // LoginPage reads. `error` is kept for any other consumer that genuinely
  // wants the last auth-related error, but nothing renders it directly.
  error: null,
  loginError: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },
    logoutLocal: (state) => {
      state.user = null;
      state.accessToken = null;
      state.status = 'idle';
    },
    // Lets LoginPage clear any previous login attempt's error as soon as it
    // mounts (e.g. after being redirected here from an expired session) —
    // that redirect is not itself a failed login and shouldn't look like one.
    clearLoginError: (state) => {
      state.loginError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.loginError = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.loginError = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.loginError = action.payload;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        // Expected outcome on first load with no session, or an expired one —
        // never a "login failed" event, so it must never populate loginError.
        // Kept on `error` (not surfaced anywhere) purely for debugging/devtools.
        state.user = null;
        state.accessToken = null;
        state.status = 'failed';
        state.error = action.payload || 'Not authenticated';
      })
      .addCase(restoreSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(restoreSession.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'idle';
      });
  },
});

export const { setAccessToken, logoutLocal, clearLoginError } = authSlice.actions;
export default authSlice.reducer;