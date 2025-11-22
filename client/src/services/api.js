/**
 * API Client
 * Handles all API requests to backend
 * ✅ Integrated with toast notification system for automatic success/error messages
 */

import { useAuthStore } from '../store/useAuthStore.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ✅ Toast notification handler (will be set by App.jsx)
let toastHandler = null;

export function setToastHandler(handler) {
  toastHandler = handler;
}

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.suppressToasts = false; // Can be set to true to suppress toasts for specific requests
  }

  getToken() {
    return useAuthStore.getState().accessToken;
  }

  /**
   * Show toast notification (if handler is available)
   */
  _showToast(message, type, duration) {
    if (toastHandler && !this.suppressToasts) {
      toastHandler(message, type, duration);
    }
  }

  /**
   * Public method to show toast notification
   */
  showToast(message, type = 'info', duration = 4000) {
    if (toastHandler) {
      toastHandler(message, type, duration);
    }
  }

  request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();
    const suppressToasts = options.suppressToasts || false;

    // Don't set Content-Type if body is not provided (e.g., refresh token endpoint)
    // Also don't set Content-Type for FormData (multipart/form-data)
    const hasBody = options.body !== undefined;
    const isFormData = options.body instanceof FormData;
    
    const config = {
      ...options,
      headers: {
        ...(hasBody && !isFormData && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    // Remove suppressToasts from options before passing to fetch
    delete config.suppressToasts;

    return fetch(url, config)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        
        // Handle errors
        if (!response.ok) {
          const errorMessage = data.error?.message || data.message || `Request failed: ${response.statusText}`;
          
          // ✅ Show error toast (unless suppressed)
          if (!suppressToasts) {
            this._showToast(errorMessage, 'error', 5000);
          }
          
          throw new Error(errorMessage);
        }

        // ✅ Show success toast for POST/PUT/DELETE operations (unless suppressed)
        // Only show if backend explicitly returns a message or success field
        if (!suppressToasts && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
          // Check if response has a success message from backend
          if (data.message) {
            this._showToast(data.message, 'success', 3000);
          } else if (data.success === true && data.message) {
            // Some endpoints return { success: true, message: "..." }
            this._showToast(data.message, 'success', 3000);
          }
          // If no message, don't show toast (silent success)
        }

        return data;
      })
      .catch((error) => {
        // Only log non-network errors to avoid console spam
        if (!error.message?.includes('Failed to fetch') && !error.message?.includes('ERR_CONNECTION_REFUSED')) {
          console.error('API request failed:', error);
        }
        
        // ✅ Show error toast for network errors (unless suppressed)
        if (!suppressToasts && (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED'))) {
          this._showToast('Connection error. Please check if the server is running.', 'error', 5000);
        }
        
        throw error;
      });
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      credentials: 'include', // For refresh token cookie
    });
  }

  async refreshToken() {
    return this.request('/auth/refresh', {
      method: 'POST',
      credentials: 'include', // For refresh token cookie
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Project endpoints
  async getProjects(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/projects?${queryString}`);
  }

  async getProject(id) {
    return this.request(`/projects/${id}`);
  }

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(id, projectData) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  }

  async deleteProject(id) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Assets endpoints
  async getStorageQuota() {
    return this.request('/assets/quota', {
      method: 'GET',
    });
  }

  async listAssets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/assets?${queryString}`, {
      method: 'GET',
    });
  }

  async requestUpload(fileData) {
    return this.request('/assets/upload/request', {
      method: 'POST',
      body: JSON.stringify(fileData),
    });
  }

  async completeUpload(assetId) {
    return this.request(`/assets/upload/complete/${assetId}`, {
      method: 'POST',
    });
  }

  async deleteAsset(assetId) {
    return this.request(`/assets/${assetId}`, {
      method: 'DELETE',
    });
  }

  async renameAsset(assetId, newName) {
    return this.request(`/assets/${assetId}/rename`, {
      method: 'PATCH',
      body: JSON.stringify({ newName }),
    });
  }

  async moveAsset(assetId, folderPath, parentFolderId) {
    return this.request(`/assets/${assetId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ folderPath, parentFolderId }),
    });
  }

  async createFolder(name, parentFolderId) {
    return this.request('/assets/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentFolderId }),
    });
  }

  async listFolders(parentFolderId) {
    const queryString = parentFolderId ? `?parentFolderId=${parentFolderId}` : '';
    return this.request(`/assets/folders${queryString}`, {
      method: 'GET',
    });
  }

  async deleteFolder(folderId) {
    return this.request(`/assets/folders/${folderId}`, {
      method: 'DELETE',
    });
  }

  // System Assets (DAWG Library)
  async listSystemAssets(params = {}) {
    // ✅ FIX: Filter out undefined/null values to avoid "undefined" in query string
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
    );
    const queryString = new URLSearchParams(cleanParams).toString();
    return this.request(`/assets/system?${queryString}`, {
      method: 'GET',
    });
  }

  async getSystemAsset(assetId) {
    return this.request(`/assets/system/${assetId}`, {
      method: 'GET',
    });
  }

  async listSystemPacks(params = {}) {
    // ✅ FIX: For admin panel, explicitly don't pass isActive filter
    // Backend will detect authentication and show all packs for authenticated users
    const queryParams = { ...params };
    // ✅ FIX: Explicitly remove isActive from query params so backend shows all packs (active + inactive) for authenticated users
    delete queryParams.isActive;
    // ✅ FIX: Filter out undefined/null values to avoid "undefined" in query string
    const cleanParams = Object.fromEntries(
      Object.entries(queryParams).filter(([_, value]) => value !== undefined && value !== null)
    );
    const queryString = new URLSearchParams(cleanParams).toString();
    console.log('📦 listSystemPacks called with params:', queryParams);
    console.log('📦 Query string:', queryString);
    console.log('📦 Auth token present:', !!this.getToken());
    // ✅ FIX: Ensure Authorization header is sent for authenticated requests
    return this.request(`/assets/system/packs?${queryString}`, {
      method: 'GET',
    });
  }

  async getSystemPack(packId) {
    return this.request(`/assets/system/packs/${packId}`, {
      method: 'GET',
    });
  }

  async listSystemCategories() {
    return this.request(`/assets/system/categories`, {
      method: 'GET',
    });
  }

  async updateSystemCategory(categoryId, updates) {
    return this.request(`/assets/admin/system/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async trackSystemAssetUsage(assetId, usageType, projectId) {
    return this.request(`/assets/system/${assetId}/usage`, {
      method: 'POST',
      body: JSON.stringify({ usageType, projectId }),
    });
  }

  // Admin endpoints
  async uploadSystemAsset(formData) {
    const token = this.getToken();
    return fetch(`${this.baseURL}/admin/system/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || `Upload failed: ${response.statusText}`);
      }
      return response.json();
    });
  }

  async updateSystemAsset(assetId, updates) {
    return this.request(`/admin/system/assets/${assetId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSystemAsset(assetId) {
    return this.request(`/admin/system/assets/${assetId}`, {
      method: 'DELETE',
    });
  }

  async createSystemPack(packData) {
    return this.request(`/assets/admin/system/packs`, {
      method: 'POST',
      body: JSON.stringify(packData),
    });
  }

  async updateSystemPack(packId, updates) {
    return this.request(`/assets/admin/system/packs/${packId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSystemPack(packId) {
    return this.request(`/assets/admin/system/packs/${packId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
