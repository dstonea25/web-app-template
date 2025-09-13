import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { tokens, cn } from '../theme/config';

export type ModuleId = 'todos' | 'ideas' | 'time_tracking';

interface MobileDrawerItem {
  id: ModuleId;
  label: string;
  icon: React.ReactNode;
}

interface MobileDrawerProps {
  items: MobileDrawerItem[];
  activeModule: ModuleId;
  open: boolean;
  onModuleChange: (module: ModuleId) => void;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  items,
  activeModule,
  open,
  onModuleChange,
  onClose,
}) => {
  const panelRef = useRef<HTMLElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);

  // Close handler with stable identity
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Focus trap, ESC handling, and body scroll lock
  useEffect(() => {
    if (!open) {
      // Restore scroll and focus when closing
      if (previousOverflowRef.current !== null) {
        document.documentElement.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
      return;
    }

    previousActiveElement.current = document.activeElement as HTMLElement;
    previousOverflowRef.current = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    // Focus first focusable inside panel
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || panel).focus();
    };
    setTimeout(focusFirst, 0);

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusableElements = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusableElements.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === panel) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeydown, true);

    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
      if (previousOverflowRef.current !== null) {
        document.documentElement.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
    };
  }, [open, handleClose]);

  if (!open) return null;

  const content = (
    <div id="mobile-drawer" aria-hidden={!open}>
      <div
        className={cn(tokens.mobile_drawer.overlay, 'fixed inset-0 z-[90]')}
        onClick={handleClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        className={cn(
          tokens.mobile_drawer.panel,
          'fixed inset-y-0 left-0 z-[100] transform transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        ref={(el) => {
          panelRef.current = el;
        }}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex-1">
          <h2 id="mobile-nav-title" className="sr-only">Navigation</h2>
          <ul className="space-y-1">
            {items.map((item, index) => {
              const isActive = activeModule === item.id;
              return (
                <li key={item.id}>
                  <button
                    ref={index === 0 ? firstItemRef : undefined}
                    onClick={() => {
                      onModuleChange(item.id);
                      handleClose();
                    }}
                    className={cn(
                      tokens.sidebar.item_base,
                      tokens.sidebar.item_hover,
                      isActive && tokens.sidebar.item_active,
                      'w-full text-left focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-neutral-950'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className={tokens.sidebar.icon}>{item.icon}</span>
                    <span className={tokens.sidebar.label}>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
};
