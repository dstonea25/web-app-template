/**
 * Settings/Account Tab
 * 
 * User profile, preferences, and account management.
 */

import React, { useState } from 'react';
import { User, Mail, Lock, Bell, Moon, LogOut, Save, AlertTriangle } from 'lucide-react';
import { tokens, cn, palette } from '../theme/config';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../lib/auth';
import { toast } from '../lib/notifications/toast';
import { CollapsibleModule } from '../components/CollapsibleModule';

interface SettingsTabProps {
  isVisible?: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ isVisible }) => {
  const { user, updateProfile, logout } = useAuth();
  
  // Profile state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Preferences (stored in localStorage for now, can be moved to DB)
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('user-preferences');
      return saved ? JSON.parse(saved) : {
        notifications: true,
        compactMode: false,
        theme: 'dark',
      };
    } catch {
      return { notifications: true, compactMode: false, theme: 'dark' };
    }
  });

  if (!isVisible) return null;

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const success = await updateProfile({ displayName });
      if (success) {
        toast.success('Profile updated');
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await authService.updatePassword(newPassword);
      if (result.success) {
        toast.success('Password changed successfully');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(result.error || 'Failed to change password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePreferenceChange = (key: string, value: any) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      localStorage.setItem('user-preferences', JSON.stringify(updated));
    } catch {}
    toast.success('Preference saved');
  };

  const handleSignOut = async () => {
    await logout();
    toast.info('Signed out');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Section */}
      <CollapsibleModule 
        title="Profile" 
        subtitle="Your account information"
        icon={<User className="w-5 h-5" />}
      >
        <div className={tokens.card.base}>
          <div className="space-y-4">
            {/* Avatar placeholder */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold',
                palette.primaryBg, 'text-white'
              )}>
                {(displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className={cn('font-medium', palette.text)}>
                  {displayName || user?.email?.split('@')[0] || 'User'}
                </div>
                <div className={cn('text-sm', palette.textMuted)}>{user?.email}</div>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className={cn('block mb-1', tokens.text.label)}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={cn(tokens.input.base, tokens.input.focus)}
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className={cn('block mb-1', tokens.text.label)}>
                Email
              </label>
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg',
                palette.bgSurfaceAlt, palette.text
              )}>
                <Mail className="w-4 h-4" />
                {user?.email}
              </div>
              <p className={cn('text-xs mt-1', palette.textMuted)}>
                Contact support to change your email
              </p>
            </div>

            {/* Member since */}
            {user?.createdAt && (
              <div className={cn('text-sm', palette.textMuted)}>
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </div>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className={cn(tokens.button.base, tokens.button.primary)}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSavingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </CollapsibleModule>

      {/* Preferences Section */}
      <CollapsibleModule 
        title="Preferences" 
        subtitle="Customize your experience"
        icon={<Moon className="w-5 h-5" />}
      >
        <div className={tokens.card.base}>
          <div className="space-y-4">
            {/* Notifications */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Bell className={cn('w-5 h-5', palette.textMuted)} />
                <div>
                  <div className={palette.text}>Notifications</div>
                  <div className={cn('text-sm', palette.textMuted)}>
                    Show toast notifications
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications}
                onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
                className="w-5 h-5 rounded"
              />
            </label>

            {/* Compact Mode */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={cn('w-5 h-5 flex items-center justify-center', palette.textMuted)}>
                  ⊞
                </div>
                <div>
                  <div className={palette.text}>Compact Mode</div>
                  <div className={cn('text-sm', palette.textMuted)}>
                    Reduce spacing and padding
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.compactMode}
                onChange={(e) => handlePreferenceChange('compactMode', e.target.checked)}
                className="w-5 h-5 rounded"
              />
            </label>

            {/* Theme (placeholder - currently dark only) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className={cn('w-5 h-5', palette.textMuted)} />
                <div>
                  <div className={palette.text}>Theme</div>
                  <div className={cn('text-sm', palette.textMuted)}>
                    Color scheme
                  </div>
                </div>
              </div>
              <select
                value={preferences.theme}
                onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                className={cn(tokens.input.base, tokens.input.focus, 'w-32')}
              >
                <option value="dark">Dark</option>
                <option value="light" disabled>Light (coming soon)</option>
                <option value="system" disabled>System (coming soon)</option>
              </select>
            </div>
          </div>
        </div>
      </CollapsibleModule>

      {/* Security Section */}
      <CollapsibleModule 
        title="Security" 
        subtitle="Password and authentication"
        icon={<Lock className="w-5 h-5" />}
        defaultExpanded={false}
      >
        <div className={tokens.card.base}>
          <div className="space-y-4">
            <div>
              <label className={cn('block mb-1', tokens.text.label)}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className={cn(tokens.input.base, tokens.input.focus)}
              />
            </div>

            <div>
              <label className={cn('block mb-1', tokens.text.label)}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={cn(tokens.input.base, tokens.input.focus)}
              />
            </div>

            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className={cn(
                tokens.button.base, 
                tokens.button.secondary,
                (!newPassword || !confirmPassword) && 'opacity-50'
              )}
            >
              <Lock className="w-4 h-4 mr-2" />
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </CollapsibleModule>

      {/* Account Actions */}
      <CollapsibleModule 
        title="Account" 
        subtitle="Sign out and account management"
        icon={<AlertTriangle className="w-5 h-5" />}
        defaultExpanded={false}
      >
        <div className={tokens.card.base}>
          <div className="space-y-4">
            <button
              onClick={handleSignOut}
              className={cn(tokens.button.base, tokens.button.danger, 'w-full justify-center')}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>

            <div className={cn('text-sm text-center', palette.textMuted)}>
              Signed in as <strong>{user?.email}</strong>
            </div>
          </div>
        </div>
      </CollapsibleModule>
    </div>
  );
};
