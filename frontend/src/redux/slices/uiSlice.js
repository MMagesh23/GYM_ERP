import { createSlice } from '@reduxjs/toolkit';

const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('gym-erp-theme') : null;
const storedCollapsed = typeof window !== 'undefined' ? localStorage.getItem('gym-erp-sidebar-collapsed') : null;

const initialState = {
  theme: storedTheme || 'light',
  sidebarCollapsed: storedCollapsed === 'true',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') localStorage.setItem('gym-erp-theme', state.theme);
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      if (typeof window !== 'undefined') localStorage.setItem('gym-erp-sidebar-collapsed', String(state.sidebarCollapsed));
    },
  },
});

export const { toggleTheme, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;