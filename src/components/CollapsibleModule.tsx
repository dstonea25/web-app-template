/**
 * CollapsibleModule - Reusable collapsible section component
 * 
 * Use this for organizing tabs into multiple modules/sections.
 * Each module has a header with title, optional subtitle, and collapse toggle.
 * 
 * Usage:
 * <CollapsibleModule title="Monthly Overview" defaultExpanded={true}>
 *   <YourContent />
 * </CollapsibleModule>
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { tokens, cn, palette } from '../theme/config';

export interface CollapsibleModuleProps {
  /** Module title displayed in header */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Whether module starts expanded (default: true) */
  defaultExpanded?: boolean;
  /** Controlled expanded state (makes component controlled) */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Content to render when expanded */
  children: React.ReactNode;
  /** Optional icon to display before title */
  icon?: React.ReactNode;
  /** Optional badge/count to display in header */
  badge?: React.ReactNode;
  /** Optional actions to display on the right side of header */
  headerActions?: React.ReactNode;
  /** Additional class names for the container */
  className?: string;
  /** Whether to show a card wrapper around content (default: false) */
  cardContent?: boolean;
  /** ID for the module (useful for persisting state) */
  id?: string;
}

export const CollapsibleModule: React.FC<CollapsibleModuleProps> = ({
  title,
  subtitle,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandedChange,
  children,
  icon,
  badge,
  headerActions,
  className,
  cardContent = false,
  id,
}) => {
  // Support both controlled and uncontrolled modes
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = useCallback(() => {
    const newValue = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
    onExpandedChange?.(newValue);
  }, [isExpanded, isControlled, onExpandedChange]);

  return (
    <section className={cn('mb-6', className)} id={id}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handleToggle}
          className={cn(
            'flex items-center gap-2 text-left transition-colors',
            palette.text,
            palette.primaryTextHover
          )}
          aria-expanded={isExpanded}
          aria-controls={id ? `${id}-content` : undefined}
        >
          {/* Expand/Collapse Icon */}
          <span className={cn(
            'transition-transform duration-200',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}>
            <ChevronDown className="w-5 h-5" />
          </span>

          {/* Optional Icon */}
          {icon && <span className={palette.primaryText}>{icon}</span>}

          {/* Title & Subtitle */}
          <div>
            <h2 className={cn('text-lg font-semibold', palette.text)}>
              {title}
            </h2>
            {subtitle && (
              <p className={cn('text-sm', palette.textMuted)}>{subtitle}</p>
            )}
          </div>

          {/* Optional Badge */}
          {badge && (
            <span className={cn(tokens.badge.base, tokens.badge.neutral, 'ml-2')}>
              {badge}
            </span>
          )}
        </button>

        {/* Header Actions (don't toggle on click) */}
        {headerActions && (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {headerActions}
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div 
          id={id ? `${id}-content` : undefined}
          className={cardContent ? tokens.card.base : undefined}
        >
          {children}
        </div>
      )}
    </section>
  );
};

/**
 * Hook for managing multiple module collapse states
 * Useful when you want to persist state or have global expand/collapse all
 */
export const useModuleState = (moduleIds: string[], defaultExpanded = true) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => new Set(defaultExpanded ? moduleIds : [])
  );

  const isExpanded = useCallback(
    (id: string) => expandedModules.has(id),
    [expandedModules]
  );

  const toggle = useCallback((id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedModules(new Set(moduleIds));
  }, [moduleIds]);

  const collapseAll = useCallback(() => {
    setExpandedModules(new Set());
  }, []);

  const setExpanded = useCallback((id: string, expanded: boolean) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  return {
    expandedModules,
    isExpanded,
    toggle,
    expandAll,
    collapseAll,
    setExpanded,
  };
};

export default CollapsibleModule;
