import { AppShell } from './components/AppShell'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { cn, palette, tokens } from './theme/config'
import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={cn('min-h-screen flex items-center justify-center p-4', palette.bg)}>
          <div className={cn(tokens.card.base, 'max-w-lg', palette.dangerBorderSubtle)}>
            <h1 className={cn('text-xl font-bold mb-2', palette.dangerText)}>Something went wrong</h1>
            <p className={cn('mb-4', `text-${palette.textMuted}`)}>{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className={cn(tokens.button.base, tokens.button.primary)}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
