/**
 * Authentication Store
 * Manages user authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // User state
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isGuest: true,

      // Loading states
      isLoading: false,
      error: null,

      // Actions
      setUser: (user, accessToken) => {
        set({
          user,
          accessToken,
          isAuthenticated: !!user,
          isGuest: !user,
          error: null,
        });
      },

      setGuest: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isGuest: true,
          error: null,
        });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isGuest: true,
          error: null,
        });
        // Clear localStorage
        localStorage.removeItem('dawg-auth-storage');
      },
    }),
    {
      name: 'dawg-auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
      }),
    }
  )
);

