import React from 'react';
import type { Priority } from '../types';
import { tokens, cn } from '../theme/config';

export interface SelectPriorityProps {
  value: Priority | null;
  onChange: (value: Priority | null) => void;
  ariaLabel?: string;
  placeholderLabel?: string;
  className?: string;
}

const SelectPriority: React.FC<SelectPriorityProps> = ({ value, onChange, ariaLabel, placeholderLabel, className }) => {
  return (
    <select
      className={cn(tokens.input.base, tokens.input.focus, className, value == null && 'text-neutral-400')}
      aria-label={ariaLabel ?? 'Set priority'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? (e.target.value as Priority) : null)}
      style={value == null ? { color: '#9ca3af' } : {}}
    >
      <option value="" style={{ color: '#9ca3af' }}>{placeholderLabel ?? 'Priority'}</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  );
};

export default SelectPriority;


