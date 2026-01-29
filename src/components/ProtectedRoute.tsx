import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { Loader2 } from 'lucide-react';
import { cn, palette } from '../theme/config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', palette.bg)}>
        <div className="text-center">
          <Loader2 className={cn('w-8 h-8 animate-spin mx-auto mb-4', palette.primaryText)} />
          <p className={palette.textMuted}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
