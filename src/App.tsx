import { AppShell } from './components/AppShell'
import { PublicIntentionsPage } from './pages/PublicIntentionsPage'
import { AuthProvider } from './contexts/AuthContext'
import { TimerProvider } from './contexts/TimerContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { WorkModeProvider } from './contexts/WorkModeContext'
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
        <div style={{ padding: '20px', backgroundColor: 'red', color: 'white' }}>
          <h1>Something went wrong!</h1>
          <p>Error: {this.state.error?.message}</p>
          <pre>{this.state.error?.stack}</pre>
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
        <TimerProvider>
          <WorkModeProvider>
            {typeof window !== 'undefined' && window.location.pathname.startsWith('/intentions') ? (
              <ProtectedRoute>
                <PublicIntentionsPage />
              </ProtectedRoute>
            ) : (
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            )}
          </WorkModeProvider>
        </TimerProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
