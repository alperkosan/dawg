/**
 * Authentication Service
 * Handles authentication logic
 */

import { apiClient } from './api.js';
import { useAuthStore } from '../store/useAuthStore.js';

export const authService = {
  /**
   * Register new user
   */
  async register(userData) {
    const { setLoading, setError, setUser } = useAuthStore.getState();

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.register(userData);

      setUser(response.user, response.accessToken);

      return response;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  },

  /**
   * Login user
   */
  async login(email, password) {
    const { setLoading, setError, setUser } = useAuthStore.getState();

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.login(email, password);

      setUser(response.user, response.accessToken);

      return response;
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  },

  /**
   * Logout user
   */
  async logout() {
    const { logout } = useAuthStore.getState();

    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      // Force reload to clear all states (AudioEngine, Stores, etc.)
      window.location.href = '/auth';
    }
  },

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    const state = useAuthStore.getState();
    const { accessToken, setUser, setGuest } = state;

    if (!accessToken) {
      setGuest();
      return false;
    }

    try {
      const response = await apiClient.getCurrentUser();
      setUser(response.user, accessToken);
      return true;
    } catch (error) {
      // Token invalid, try to refresh (only if we have a token)
      if (accessToken) {
        try {
          const refreshResponse = await apiClient.refreshToken();
          if (refreshResponse.accessToken) {
            setUser(refreshResponse.user || state.user, refreshResponse.accessToken);
            return true;
          }
        } catch (refreshError) {
          // Silently fail - user might not be logged in (guest mode)
          // Only log if it's not a 401/400 error (expected for guest users)
          if (!refreshError.message?.includes('Unauthorized') &&
            !refreshError.message?.includes('Bad Request') &&
            !refreshError.message?.includes('Body cannot be empty')) {
            console.warn('Token refresh failed:', refreshError);
          }
        }
      }
      // If refresh fails or no token, clear auth but don't force logout (allow guest mode)
      setGuest();
      return false;
    }
  },

  /**
   * Continue as guest
   */
  continueAsGuest() {
    const { setGuest } = useAuthStore.getState();
    setGuest();
  },
};

