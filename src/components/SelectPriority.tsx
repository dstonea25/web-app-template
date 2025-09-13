import React from 'react';
import type { Priority } from '../types';
import { tokens, cn } from '../theme/config';
import { ChevronDown } from 'lucide-react';

export interface SelectPriorityProps {
  value: Priority | null;
  onChange: (value: Priority | null) => void;
  ariaLabel?: string;
  placeholderLabel?: string;
}

const SelectPriority: React.FC<SelectPriorityProps> = ({ value, onChange, ariaLabel, placeholderLabel }) => {
  return (
    <div className="relative">
      <select
        className={cn(tokens.input.base, tokens.input.focus, 'pr-9', value == null && 'text-neutral-400')}
        aria-label={ariaLabel ?? 'Set priority'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as Priority) : null)}
        style={value == null ? { color: '#9ca3af' } : {}}
      >
        <option value="" style={{ color: '#9ca3af' }}>{placeholderLabel ?? 'Priority'}</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
    </div>
  );
};

export default SelectPriority;


