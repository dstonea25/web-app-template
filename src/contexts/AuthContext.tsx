import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthContextType, AuthCredentials, UserProfile } from '../types';
import { authService } from '../lib/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Convert Supabase user to our UserProfile type
  const updateUserFromService = useCallback(() => {
    const supabaseUser = authService.getUser();
    if (supabaseUser) {
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
        createdAt: supabaseUser.created_at,
      });
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    // Initialize auth service and check session
    const initAuth = async () => {
      await authService.initialize();
      updateUserFromService();
      setIsLoading(false);
    };

    initAuth();

    // Subscribe to authentication state changes
    const unsubscribe = authService.subscribe(() => {
      updateUserFromService();
    });

    return unsubscribe;
  }, [updateUserFromService]);

  const login = async (credentials: AuthCredentials): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await authService.login(credentials);
      if (success) {
        updateUserFromService();
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    const success = await authService.updateProfile(updates);
    if (success) {
      updateUserFromService();
    }
    return success;
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
