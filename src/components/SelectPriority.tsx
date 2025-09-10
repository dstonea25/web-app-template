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
    <div className={tokens.select.wrapper}>
      <select
        className={cn(tokens.select.base, value == null && 'text-neutral-500')}
        aria-label={ariaLabel ?? 'Set priority'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as Priority) : null)}
      >
        <option value="">{placeholderLabel ?? '—'}</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <ChevronDown className={tokens.select.chevron} aria-hidden="true" />
    </div>
  );
};

export default SelectPriority;


