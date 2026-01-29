/**
 * API Client - Supabase Operations
 * 
 * This file provides the data layer for interacting with Supabase.
 * Add your data fetching and saving functions here.
 * 
 * Pattern: Each entity should have fetch, save/upsert, and delete functions.
 */

import type { ApiResponse, ExampleItem } from '../types';

// ===== API Client Class =====
export class ApiClient {
  constructor() {
    // Base configuration can go here
  }

  /**
   * Safely import and check Supabase availability
   * Use this pattern for all database operations
   */
  private async getSupabaseSafe(): Promise<{ supabase: any | null; isSupabaseConfigured: boolean }> {
    try {
      const mod = await import('./supabase.ts');
      return { 
        supabase: (mod as any).supabase || null, 
        isSupabaseConfigured: Boolean((mod as any).isSupabaseConfigured) 
      };
    } catch {
      return { supabase: null, isSupabaseConfigured: false };
    }
  }

  // ===== Example CRUD Operations =====
  
  /**
   * Fetch all items from a table
   */
  async fetchItems(): Promise<ExampleItem[]> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as ExampleItem[];
  }

  /**
   * Create a new item
   */
  async createItem(item: Omit<ExampleItem, 'id' | 'created_at'>): Promise<string> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { data, error } = await supabase
      .from('your_table')
      .insert(item)
      .select('id')
      .single();
    
    if (error) throw error;
    return String((data as any).id);
  }

  /**
   * Update an existing item
   */
  async updateItem(id: string, patch: Partial<ExampleItem>): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { error } = await supabase
      .from('your_table')
      .update(patch)
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Delete an item
   */
  async deleteItem(id: string): Promise<void> {
    const { supabase, isSupabaseConfigured } = await this.getSupabaseSafe();
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }
    
    const { error } = await supabase
      .from('your_table')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Generic save with mock response (useful during development)
   */
  async mockSave<T>(data: T): Promise<ApiResponse> {
    console.log('🔄 Mock API: Saving data', data);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      success: true,
      data: {
        message: 'Data saved successfully',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// ===== Singleton Instance =====
export const apiClient = new ApiClient();

// ===== Convenience Exports =====
// Export individual functions for easier imports

export const fetchItems = () => apiClient.fetchItems();
export const createItem = (item: Omit<ExampleItem, 'id' | 'created_at'>) => apiClient.createItem(item);
export const updateItem = (id: string, patch: Partial<ExampleItem>) => apiClient.updateItem(id, patch);
export const deleteItem = (id: string) => apiClient.deleteItem(id);
