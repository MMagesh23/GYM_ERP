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
  error: null,
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'failed';
        state.error = action.payload || 'Not authenticated';
      })
      .addCase(restoreSession.pending, (state) => {
        state.status = 'loading';
        state.error = null;
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

export const { setAccessToken, logoutLocal } = authSlice.actions;
export default authSlice.reducer;
