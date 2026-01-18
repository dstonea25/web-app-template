import React from 'react';
import { Briefcase } from 'lucide-react';
import { useWorkMode } from '../contexts/WorkModeContext';
import { cn } from '../theme/config';

interface WorkModeToggleProps {
  compact?: boolean;
}

export const WorkModeToggle: React.FC<WorkModeToggleProps> = () => {
  const { workMode, toggleWorkMode } = useWorkMode();

  return (
    <button
      onClick={toggleWorkMode}
      className={cn(
        "p-2 rounded-lg transition-colors",
        workMode 
          ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30" 
          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
      )}
      title={workMode ? "Work Mode: ON - Click to disable" : "Work Mode: OFF - Click to enable"}
      aria-pressed={workMode}
    >
      <Briefcase className="w-5 h-5" />
    </button>
  );
};

export default WorkModeToggle;


