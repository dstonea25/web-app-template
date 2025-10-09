import React from 'react';
import { cn, tokens } from '../../theme/config';
import type { IntentionPillar } from '../../types';

interface Props {
  pillar: IntentionPillar;
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (pillar: IntentionPillar, value: string) => void;
}

export const IntentionCard: React.FC<Props> = ({ pillar, label, value, readOnly, onChange }) => {
  return (
    <div className={cn('rounded-xl border border-neutral-800 p-4 bg-neutral-900')}> {/* match card styling */}
      <div className={cn('flex items-center justify-between mb-3', tokens.typography.weights.semibold)}>{label}</div>
      <input
        type="text"
        className={cn(tokens.input.base, tokens.input.focus)}
        placeholder="What’s one thing you’ll do today?"
        value={value}
        onChange={(e) => onChange(pillar, e.target.value)}
        readOnly={readOnly}
      />
    </div>
  );
};

export default IntentionCard;


