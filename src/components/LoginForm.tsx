import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { tokens, theme, cn, palette } from '../theme/config';

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
    if (error) setError('');
  };

  return (
    <div className={cn('min-h-screen flex items-center justify-center px-4', palette.bg)}>
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className={cn('inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4', palette.primaryBg)}>
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className={tokens.text.heading}>
            {theme.product_name}
          </h1>
          <p className={cn('mt-2', tokens.text.muted)}>
            Sign in to access your dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className={cn(tokens.card.base, theme.layout.shadow.elevated)}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className={cn('block mb-2', tokens.text.label)}>
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={tokens.icon.default} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={handleInputChange('email')}
                  className={cn(tokens.input.base, tokens.input.focus, 'pl-10')}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className={cn('block mb-2', tokens.text.label)}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={tokens.icon.default} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  className={cn(tokens.input.base, tokens.input.focus, 'pl-10 pr-10')}
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
                    <EyeOff className={cn(tokens.icon.default, tokens.link.muted)} />
                  ) : (
                    <Eye className={cn(tokens.icon.default, tokens.link.muted)} />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className={cn('p-3 rounded-lg', palette.dangerBgSubtle, palette.dangerBorderSubtle, 'border')}>
                <p className={cn('text-sm', palette.dangerTextLight)}>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !credentials.email || !credentials.password}
              className={cn(
                tokens.button.base, 
                tokens.button.primary, 
                'w-full',
                (isLoading || !credentials.email || !credentials.password) && 'opacity-50 cursor-not-allowed'
              )}
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
          <p className={cn('text-sm', palette.textSubtle)}>
            Secure access to your personal dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
