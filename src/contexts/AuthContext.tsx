import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthContextType, AuthCredentials } from '../types';
import { authService } from '../lib/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check initial authentication state
    setIsAuthenticated(authService.getAuthState());
    setIsLoading(false);

    // Subscribe to authentication state changes
    const unsubscribe = authService.subscribe(() => {
      setIsAuthenticated(authService.getAuthState());
    });

    return unsubscribe;
  }, []);

  const login = async (credentials: AuthCredentials): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await authService.login(credentials);
      return success;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
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
