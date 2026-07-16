import { createSlice } from '@reduxjs/toolkit';

const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('gym-erp-theme') : null;

const initialState = {
  theme: storedTheme || 'light', // 'light' | 'dark'
  sidebarCollapsed: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem('gym-erp-theme', state.theme);
      }
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { toggleTheme, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
