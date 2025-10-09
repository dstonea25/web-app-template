import React, { useEffect, useState } from 'react';
import { cn, tokens } from '../../theme/config';
import type { IntentionStatsRow } from '../../types';
import { fetchIntentionStats } from '../../lib/api';

export const StreakDisplay: React.FC = () => {
  const [stats, setStats] = useState<IntentionStatsRow | null>(null);
  useEffect(() => {
    let mounted = true;
    fetchIntentionStats().then((s) => { if (mounted) setStats(s); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const streak = stats?.current_streak ?? 0;
  return <div className={cn(tokens.badge.base, tokens.badge.success)}>🔥 {streak}-day streak</div>;
};

export default StreakDisplay;


