/**
 * ChallengesService - Manages Weekly Challenges API interactions
 * 
 * Uses Supabase RPCs directly:
 * - get_or_create_weekly_challenges: Returns current week's 3 challenges (creates if first call)
 * - complete_weekly_challenge: Mark a challenge complete
 * - uncomplete_weekly_challenge: Mark a challenge incomplete
 * - get_challenge_protocols: Returns all protocol configurations
 * - update_challenge_protocol: Update a protocol's settings
 */

import type { WeeklyChallengesResponse, ChallengeProtocol, RandomizationStrategy } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

export interface ChallengeConfig {
  total_challenges: number;
  randomization_strategy: RandomizationStrategy;
}

class ChallengesService {
  /**
   * Fetch weekly challenges using Supabase RPC.
   * This is the single source of truth - always returns 3 challenges for the current week.
   * Creates challenges if first call of the week (idempotent).
   */
  async fetchWeeklyChallenges(): Promise<WeeklyChallengesResponse> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('get_or_create_weekly_challenges');
    
    if (error) {
      throw new Error(`Failed to fetch weekly challenges: ${error.message}`);
    }

    // Validate response shape
    if (!data || !data.week || !Array.isArray(data.challenges)) {
      throw new Error('Invalid response format from get_or_create_weekly_challenges');
    }

    return data as WeeklyChallengesResponse;
  }

  /**
   * Mark a challenge as completed.
   * Uses Supabase RPC: complete_weekly_challenge
   */
  async completeChallenge(challengeId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured - cannot complete challenge');
    }

    const { error } = await supabase.rpc('complete_weekly_challenge', {
      p_challenge_id: challengeId,
    });

    if (error) {
      throw new Error(`Failed to complete challenge: ${error.message}`);
    }
  }

  /**
   * Mark a challenge as uncompleted.
   * Uses Supabase RPC: uncomplete_weekly_challenge
   */
  async uncompleteChallenge(challengeId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured - cannot uncomplete challenge');
    }

    const { error } = await supabase.rpc('uncomplete_weekly_challenge', {
      p_challenge_id: challengeId,
    });

    if (error) {
      throw new Error(`Failed to uncomplete challenge: ${error.message}`);
    }
  }

  /**
   * Toggle challenge completion state.
   * After toggling, caller should re-fetch to keep state consistent.
   */
  async toggleChallengeCompletion(challengeId: string, currentlyCompleted: boolean): Promise<void> {
    if (currentlyCompleted) {
      await this.uncompleteChallenge(challengeId);
    } else {
      await this.completeChallenge(challengeId);
    }
  }

  /**
   * Regenerate challenges for the current week.
   * Deletes existing challenges and set, then calls get_or_create to generate fresh ones.
   * DEV/DEBUG tool - use with caution.
   */
  async regenerateChallenges(): Promise<WeeklyChallengesResponse> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    // First, get current week info to find the set to delete
    const currentData = await this.fetchWeeklyChallenges();
    const { year, week_number } = currentData.week;

    // Delete challenges for this week's set
    // The challenges reference set_id, so we need to find and delete the set
    // which should cascade delete the challenges (or we delete challenges first)
    
    // Delete challenges first (by their IDs from current data)
    const challengeIds = currentData.challenges.map(c => c.id);
    if (challengeIds.length > 0) {
      const { error: deleteChallError } = await supabase
        .from('weekly_challenges')
        .delete()
        .in('id', challengeIds);
      
      if (deleteChallError) {
        console.warn('Failed to delete challenges:', deleteChallError);
        // Continue anyway - maybe they're already gone
      }
    }

    // Delete the challenge set for this week
    const { error: deleteSetError } = await supabase
      .from('weekly_challenge_sets')
      .delete()
      .eq('year', year)
      .eq('week_number', week_number);

    if (deleteSetError) {
      console.warn('Failed to delete challenge set:', deleteSetError);
      // Continue anyway
    }

    // Now call get_or_create which will generate fresh challenges
    return await this.fetchWeeklyChallenges();
  }

  /**
   * Fetch all challenge protocol configurations.
   */
  async fetchProtocols(): Promise<ChallengeProtocol[]> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('get_challenge_protocols');
    
    if (error) {
      throw new Error(`Failed to fetch protocols: ${error.message}`);
    }

    return (data || []) as ChallengeProtocol[];
  }

  /**
   * Update a challenge protocol's settings.
   * Only provided fields will be updated; others remain unchanged.
   * For config, the provided object is merged with existing config.
   */
  async updateProtocol(
    protocolKey: string,
    updates: {
      is_enabled?: boolean;
      max_per_week?: number;
      config?: Record<string, unknown>;
    }
  ): Promise<ChallengeProtocol> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('update_challenge_protocol', {
      p_protocol_key: protocolKey,
      p_is_enabled: updates.is_enabled ?? null,
      p_max_per_week: updates.max_per_week ?? null,
      p_config: updates.config ?? null,
    });

    if (error) {
      throw new Error(`Failed to update protocol: ${error.message}`);
    }

    return data as ChallengeProtocol;
  }

  /**
   * Reroll a single challenge to get a different one from the same protocol.
   * Works for habits_slipping and priorities_progress protocols.
   */
  async rerollChallenge(challengeId: string): Promise<{
    id: string;
    slot_index: number;
    action_text: string;
    story_type: string;
    story_data: Record<string, unknown>;
    protocol_key: string;
    completed: boolean;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('reroll_challenge', {
      p_challenge_id: challengeId,
    });

    if (error) {
      throw new Error(`Failed to reroll challenge: ${error.message}`);
    }

    return data;
  }

  /**
   * Fetch global challenge configuration.
   */
  async fetchConfig(): Promise<ChallengeConfig> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.rpc('get_challenge_config');

    if (error) {
      throw new Error(`Failed to fetch config: ${error.message}`);
    }

    return {
      total_challenges: data?.total_challenges ?? 3,
      randomization_strategy: data?.randomization_strategy ?? 'guaranteed_diversity',
    };
  }

  /**
   * Update global challenge configuration.
   * Value is stored as JSONB, so we pass it as a JSON value.
   */
  async updateConfig(key: string, value: number | string | boolean): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase not configured');
    }

    // Convert value to proper JSON format
    const jsonValue = typeof value === 'string' ? value : value;

    const { error } = await supabase.rpc('update_challenge_config', {
      p_key: key,
      p_value: jsonValue,
    });

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Update the randomization strategy.
   */
  async updateRandomizationStrategy(strategy: RandomizationStrategy): Promise<void> {
    await this.updateConfig('randomization_strategy', strategy);
  }
}

// Export singleton instance
export const challengesService = new ChallengesService();
