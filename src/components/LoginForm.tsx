import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tokens, theme } from '../theme/config';

export function LoginForm() {
  const { login, isLoading } = useAuth();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }

    const success = await login(credentials);
    if (!success) {
      setError('Invalid email or password');
    }
  };

  const handleInputChange = (field: 'email' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({ ...prev, [field]: e.target.value }));
    if (error) setError(''); // Clear error when user starts typing
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className={`${tokens.typography.scale.h2} ${tokens.typography.weights.bold} text-neutral-100`}>
            Geronimo
          </h1>
          <p className={`${tokens.typography.scale.muted} text-neutral-400 mt-2`}>
            Sign in to access your dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className={`${tokens.card.base} ${theme.layout.shadow.elevated}`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-200 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-neutral-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={handleInputChange('email')}
                  className={`${tokens.input.base} ${tokens.input.focus} pl-10`}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-200 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-neutral-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  className={`${tokens.input.base} ${tokens.input.focus} pl-10 pr-10`}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-neutral-400 hover:text-neutral-300" />
                  ) : (
                    <Eye className="w-4 h-4 text-neutral-400 hover:text-neutral-300" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-900/20 border border-rose-900/30">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !credentials.email || !credentials.password}
              className={`${tokens.button.base} ${tokens.button.primary} w-full ${
                isLoading || !credentials.email || !credentials.password
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className={`${tokens.typography.scale.muted} text-neutral-500`}>
            Secure access to your personal dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
