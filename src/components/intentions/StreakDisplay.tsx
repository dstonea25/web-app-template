import React, { useEffect, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import type { IntentionStatsRow } from '../../types';
import { fetchIntentionStats } from '../../lib/api';

const getStreakEmoji = (streak: number) => {
  if (streak === 0) return '❄️';
  if (streak < 3) return '🔥';
  if (streak < 7) return '🔥🔥';
  return '🔥🔥🔥';
};

const getDaysSinceLastCompleted = (lastCompletedDate: string | null): number => {
  if (!lastCompletedDate) return 999; // Never completed
  const lastDate = new Date(lastCompletedDate);
  const today = new Date();
  const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysDiff);
};

export const StreakDisplay: React.FC = () => {
  const [stats, setStats] = useState<IntentionStatsRow[]>([]);
  
  useEffect(() => {
    let mounted = true;
    fetchIntentionStats().then((s) => { 
      if (mounted) setStats(s); 
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  
  if (stats.length === 0) {
    return <div className={cn(tokens.badge.base, tokens.badge.neutral)}>Loading streaks...</div>;
  }
  
  return (
    <div className="flex flex-wrap gap-1">
      {stats.map(stat => {
        if (stat.current_streak === 0) {
          const daysSince = getDaysSinceLastCompleted(stat.last_completed_date);
          return (
            <div key={stat.pillar} className={cn(tokens.badge.base, tokens.badge.neutral)}>
              {stat.pillar} ❄️ cold for {daysSince} days
            </div>
          );
        }
        return (
          <div key={stat.pillar} className={cn(tokens.badge.base, tokens.badge.success)}>
            {stat.pillar} {getStreakEmoji(stat.current_streak)} {stat.current_streak}-day streak
          </div>
        );
      })}
    </div>
  );
};

export default StreakDisplay;


