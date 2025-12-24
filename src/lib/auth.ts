import type { AuthCredentials } from '../types';
import { supabase } from './supabase';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

// Storage key for backwards compatibility cleanup
const LEGACY_AUTH_STORAGE_KEY = 'dashboard_auth_token';

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private listeners: Array<() => void> = [];
  private initialized = false;

  private constructor() {
    // Clean up legacy auth token if present
    try {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized || !supabase) return;

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    this.currentUser = session?.user ?? null;

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      this.currentUser = session?.user ?? null;
      this.notifyListeners();
    });

    this.initialized = true;
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
    if (!supabase) {
      console.error('Supabase not configured');
      return false;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      console.error('Login error:', error.message);
      return false;
    }

    this.currentUser = data.user;
    this.notifyListeners();
    return true;
  }

  async logout(): Promise<void> {
    if (!supabase) return;

    await supabase.auth.signOut();
    this.currentUser = null;
    this.notifyListeners();
  }

  getAuthState(): boolean {
    return this.currentUser !== null;
  }

  getUser(): User | null {
    return this.currentUser;
  }
}

// Create singleton instance
export const authService = AuthService.getInstance();
