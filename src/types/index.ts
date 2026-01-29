/**
 * Type Definitions
 * 
 * Define your TypeScript interfaces and types here.
 * Keep types organized by feature/domain.
 */

// ===== API Types =====

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ===== Example Entity Types =====
// Replace these with your actual domain types

export interface ExampleItem {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at?: string;
}

// ===== Form/Input Types =====

export interface ExampleItemInput {
  title: string;
  description?: string;
  status?: 'active' | 'completed' | 'archived';
}

// ===== UI State Types =====

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

// ===== Auth Types =====

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
}

// ===== Add your types below =====
