import React from 'react';
import { useWorkMode } from '../contexts/WorkModeContext';
import { tokens, cn } from '../theme/config';

interface WorkModeToggleProps {
  compact?: boolean;
}

export const WorkModeToggle: React.FC<WorkModeToggleProps> = ({ compact = false }) => {
  const { workMode, toggleWorkMode } = useWorkMode();

  return (
    <button
      onClick={toggleWorkMode}
      className={cn(tokens.button.base, tokens.button.ghost, 'text-sm flex items-center gap-2', compact && 'px-2 py-1')}
      aria-pressed={workMode}
      title={workMode ? 'Disable Work Mode' : 'Enable Work Mode'}
    >
      <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', workMode ? 'bg-emerald-400' : 'bg-neutral-500')} />
      <span className={cn('hidden sm:inline')}>Work Mode</span>
      <span className={cn('sm:hidden')}>Work</span>
    </button>
  );
};

export default WorkModeToggle;


