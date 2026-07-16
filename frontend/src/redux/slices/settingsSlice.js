import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { settingsApi } from '../../services/settingsApi';

export const fetchSettings = createAsyncThunk('settings/fetch', async (_, { rejectWithValue }) => {
  try {
    const { data } = await settingsApi.get();
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load settings');
  }
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { data: null, status: 'idle' },
  reducers: {
    // Lets Settings page push fresh data in immediately after a save, no refetch needed
    setSettings: (state, action) => {
      state.data = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchSettings.rejected, (state) => {
        state.status = 'failed';
      });
  },
});

export const { setSettings } = settingsSlice.actions;
export default settingsSlice.reducer;