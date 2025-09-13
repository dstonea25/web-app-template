import type { AuthCredentials } from '../types';

// Environment variables for credentials
const AUTH_USERNAME = import.meta.env.VITE_AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || 'password123';

// Storage key for authentication state
const AUTH_STORAGE_KEY = 'dashboard_auth_token';

export class AuthService {
  private static instance: AuthService;
  private isAuthenticated = false;
  private listeners: Array<() => void> = [];

  private constructor() {
    // Check if user is already authenticated on initialization
    this.isAuthenticated = this.checkStoredAuth();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private checkStoredAuth(): boolean {
    try {
      const token = localStorage.getItem(AUTH_STORAGE_KEY);
      return token === 'authenticated';
    } catch {
      return false;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async login(credentials: AuthCredentials): Promise<boolean> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (credentials.username === AUTH_USERNAME && credentials.password === AUTH_PASSWORD) {
      this.isAuthenticated = true;
      localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated');
      this.notifyListeners();
      return true;
    }
    
    return false;
  }

  logout(): void {
    this.isAuthenticated = false;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.notifyListeners();
  }

  getAuthState(): boolean {
    return this.isAuthenticated;
  }
}

// Create singleton instance
export const authService = AuthService.getInstance();
