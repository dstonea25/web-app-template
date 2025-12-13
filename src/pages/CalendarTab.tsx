import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useTransition, useDeferredValue } from 'react';
import { tokens, cn } from '../theme/config';
import { Calendar, X, Plus, Edit2, Trash2, Settings, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { apiClient } from '../lib/api';
import { toast } from '../lib/notifications/toast';
import type { CalendarEvent, CalendarEventInput } from '../types';

interface CalendarTabProps {
  isVisible?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  travel: { bg: 'bg-teal-900/20', text: 'text-teal-300', border: 'border-teal-900/30' },
  medical: { bg: 'bg-rose-900/20', text: 'text-rose-300', border: 'border-rose-900/30' },
  social: { bg: 'bg-amber-900/20', text: 'text-amber-300', border: 'border-amber-900/30' },
  work: { bg: 'bg-emerald-900/20', text: 'text-emerald-300', border: 'border-emerald-900/30' },
  personal: { bg: 'bg-neutral-800/60', text: 'text-neutral-300', border: 'border-neutral-700' },
};

const getCategoryStyle = (category: string | null | undefined) => {
  if (!category) return CATEGORY_COLORS.personal;
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.personal;
};

interface DayData {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Mon, Tue, etc.
  dayNumber: number; // 1-31
  isWeekend: boolean;
  monthName: string; // January, February, etc.
  monthIndex: number; // 0-11
  events: CalendarEvent[];
}

export const CalendarTab: React.FC<CalendarTabProps> = ({ isVisible }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  
  const [isPending, startTransition] = useTransition();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPastMonths, setShowPastMonths] = useState(() => {
    try {
      const saved = localStorage.getItem('calendar-show-past-months');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [snapToToday, setSnapToToday] = useState(() => {
    try {
      return localStorage.getItem('calendar-snap-to-today') === 'true';
    } catch {
      return false;
    }
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showMonthIndex, setShowMonthIndex] = useState(false); // Auto-hide month index
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [renderedDays, setRenderedDays] = useState<DayData[]>([]); // Progressive rendering
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  
  // Natural Language input state
  const [nlInput, setNlInput] = useState('');
  const [showNlPanel, setShowNlPanel] = useState(false);
  const [showNlSheet, setShowNlSheet] = useState(false); // Mobile bottom sheet
  const [isYearHeaderVisible, setIsYearHeaderVisible] = useState(true); // Track year header visibility
  
  // Track which months are expanded (default: current month + all future)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    const today = new Date();
    const expanded = new Set<string>();
    
    // Expand current month + all future months
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    for (let year = currentYear; year <= currentYear + 1; year++) {
      const startMonth = year === currentYear ? currentMonth : 0;
      const endMonth = 11;
      
      for (let month = startMonth; month <= endMonth; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        expanded.add(key);
      }
    }
    
    return expanded;
  });
  const settingsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const topRef = useRef<HTMLDivElement>(null); // Ref for scrolling to top
  const monthIndexTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For auto-hide
  const hasInitiallyRendered = useRef(false);
  const hasLoadedPast = useRef(false);
  const nlPanelRef = useRef<HTMLDivElement>(null);
  const nlInputRef = useRef<HTMLInputElement>(null);
  const nlSheetInputRef = useRef<HTMLInputElement>(null);

  // Note: Removed deferredValue since we're using progressive rendering now
  // Progressive rendering already handles non-blocking updates

  // Helper to parse date string in local time (not UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  
  // Toggle month expansion
  const toggleMonth = (year: number, monthIndex: number) => {
    const key = `${year}-${String(monthIndex).padStart(2, '0')}`;
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Calculate date range based on selectedYear and Q4 logic
  const { startYear, endYear } = useMemo(() => {
    let endYr = selectedYear;
    
    if (selectedYear === currentYear && currentMonth >= 9) {
      // Q4 of current year: extend into next year
      endYr = selectedYear + 1;
    }
    
    return {
      startYear: selectedYear,
      endYear: endYr,
    };
  }, [selectedYear, currentYear, currentMonth]);

  // Helper: Generate days between two dates
  const generateDaysInRange = (startDate: Date, endDate: Date): DayData[] => {
    const days: DayData[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      days.push({
        date: dateStr,
        dayOfWeek,
        dayNumber: currentDate.getDate(),
        isWeekend,
        monthName,
        monthIndex: currentDate.getMonth(),
        events: [],
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  // SINGLE EFFECT: Handle all day generation with TWO PATHS
  useEffect(() => {
    if (!isVisible) return;
    
    // Reset guards when year/mode changes
    hasLoadedPast.current = false;
    
    // Both modes: Render all days from year start to year end
    const yearStart = new Date(startYear, 0, 1);
    const yearEnd = new Date(endYear, 11, 31, 23, 59, 59);
    const allDays = generateDaysInRange(yearStart, yearEnd);
    
    setRenderedDays(allDays);
    setIsLoading(false);
    
    // If snap-to-today is enabled, we'll scroll to today in useLayoutEffect
    
  }, [isVisible, selectedYear, startYear, endYear, snapToToday]);

  // Scroll to today when snap-to-today is enabled
  useEffect(() => {
    if (!snapToToday || !isVisible || renderedDays.length === 0) return;
    
    // Multiple attempts with increasing delays to ensure DOM is ready
    const attempts = [100, 300, 500];
    const timeouts: NodeJS.Timeout[] = [];
    
    attempts.forEach(delay => {
      const timeout = setTimeout(() => {
        if (todayRef.current) {
          todayRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start', // Respects scroll-margin-top for offset
            inline: 'nearest'
          });
          // Clear remaining timeouts
          timeouts.forEach(t => clearTimeout(t));
        }
      }, delay);
      timeouts.push(timeout);
    });
    
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [snapToToday, isVisible, renderedDays.length]);

  // Use rendered days
  const daysData = renderedDays;

  // Map events to days
  const daysWithEvents = useMemo(() => {
    const eventsByDate = new Map<string, CalendarEvent[]>();
    events.forEach(event => {
      const existing = eventsByDate.get(event.date) || [];
      existing.push(event);
      eventsByDate.set(event.date, existing);
    });
    
    return daysData.map(day => ({
      ...day,
      events: eventsByDate.get(day.date) || [],
    }));
  }, [daysData, events]);

  // Filter days based on showPastMonths
  const visibleDays = useMemo(() => {
    if (showPastMonths) {
      return daysWithEvents;
    }
    
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    const filtered = daysWithEvents.filter(day => {
      const dayDate = parseLocalDate(day.date);
      const dayYear = dayDate.getFullYear();
      const dayMonth = dayDate.getMonth();
      
      // Show if year is in the future
      if (dayYear > todayYear) return true;
      // Hide if year is in the past
      if (dayYear < todayYear) return false;
      // Same year: show if month >= current month
      return dayMonth >= todayMonth;
    });
    
    return filtered;
  }, [daysWithEvents, showPastMonths, parseLocalDate]);

  // Group days by month for rendering (handles cross-year ranges)
  const monthGroups = useMemo(() => {
    const groups: { monthName: string; monthIndex: number; year: number; days: DayData[] }[] = [];
    let currentKey = '';
    let currentGroup: DayData[] = [];
    
    visibleDays.forEach(day => {
      const dayDate = parseLocalDate(day.date);
      const dayYear = dayDate.getFullYear();
      const dayMonth = dayDate.getMonth();
      const key = `${dayYear}-${dayMonth}`;
      
      if (key !== currentKey) {
        if (currentGroup.length > 0) {
          const firstDay = currentGroup[0];
          const firstDayDate = parseLocalDate(firstDay.date);
          const isLookAhead = firstDayDate.getFullYear() !== selectedYear;
          const displayName = isLookAhead 
            ? `${firstDay.monthName} ${firstDayDate.getFullYear()}`
            : firstDay.monthName;
          
          groups.push({
            monthName: displayName,
            monthIndex: firstDayDate.getMonth(),
            year: firstDayDate.getFullYear(),
            days: currentGroup,
          });
        }
        currentKey = key;
        currentGroup = [day];
      } else {
        currentGroup.push(day);
      }
    });
    
    if (currentGroup.length > 0) {
      const firstDay = currentGroup[0];
      const firstDayDate = parseLocalDate(firstDay.date);
      const isLookAhead = firstDayDate.getFullYear() !== selectedYear;
      const displayName = isLookAhead 
        ? `${firstDay.monthName} ${firstDayDate.getFullYear()}`
        : firstDay.monthName;
      
      groups.push({
        monthName: displayName,
        monthIndex: firstDayDate.getMonth(),
        year: firstDayDate.getFullYear(),
        days: currentGroup,
      });
    }
    
    return groups;
  }, [visibleDays, selectedYear]);

  // Month labels for the index (based on visible months)
  const monthLabels = useMemo(() => {
    const labels: { index: number; year: number; label: string; fullName: string }[] = [];
    const seen = new Set<string>();
    
    monthGroups.forEach(group => {
      const key = `${group.year}-${group.monthIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        const date = new Date(group.year, group.monthIndex, 1);
        labels.push({
          index: group.monthIndex,
          year: group.year,
          label: date.toLocaleDateString('en-US', { month: 'short' }),
          fullName: `${date.toLocaleDateString('en-US', { month: 'long' })} ${group.year}`,
        });
      }
    });
    
    return labels;
  }, [monthGroups]);

  // Load events for the date range
  useEffect(() => {
    if (!isVisible) return;
    
    const loadEvents = async () => {
      try {
        setIsLoading(true);
        // Fetch events for all years in the range
        const yearsToFetch = [];
        for (let y = startYear; y <= endYear; y++) {
          yearsToFetch.push(y);
        }
        
        // Fetch all years in parallel
        const results = await Promise.all(
          yearsToFetch.map(y => apiClient.fetchCalendarEventsForYear(y))
        );
        
        // Flatten results
        const allEvents = results.flat();
        
        setEvents(allEvents);
      } catch (error) {
        console.error('Failed to load calendar events:', error);
        toast.error('Failed to load calendar events');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEvents();
  }, [startYear, endYear, isVisible]);

  const scrollToMonth = (monthIndex: number, year: number) => {
    const targetId = `month-${year}-${monthIndex}`;
    const element = document.getElementById(targetId);
    
    if (element) {
      const monthKey = `${year}-${monthIndex}`;
      const isExpanded = expandedMonths.has(monthKey);
      
      // If collapsed, expand it first
      if (!isExpanded) {
        setExpandedMonths(prev => new Set([...prev, monthKey]));
        
        // Wait for DOM to fully update with requestAnimationFrame + longer delay
        requestAnimationFrame(() => {
          setTimeout(() => {
            // Use instant behavior after expansion for reliable positioning
            element.scrollIntoView({ behavior: 'instant', block: 'start' });
          }, 300); // Longer delay to ensure all day rows are rendered
        });
      } else {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setIsCreating(false);
    setEditingEvent(null);
  };

  const handleCloseDetail = () => {
    setSelectedDate(null);
    setIsCreating(false);
    setEditingEvent(null);
  };

  const handleCreateEvent = () => {
    setIsCreating(true);
    setEditingEvent(null);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsCreating(false);
  };

  const handleSaveEvent = async (input: CalendarEventInput, eventId?: string) => {
    try {
      if (eventId) {
        // Update existing
        await apiClient.updateCalendarEvent(eventId, input);
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...input } : e));
        toast.success('Event updated');
      } else {
        // Create new
        const newId = await apiClient.createCalendarEvent(input);
        const newEvent: CalendarEvent = {
          id: newId,
          ...input,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setEvents(prev => [...prev, newEvent]);
        toast.success('Event created');
      }
      
      setIsCreating(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    
    try {
      await apiClient.deleteCalendarEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success('Event deleted');
      setEditingEvent(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
    }
  };

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  // Close NL panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nlPanelRef.current && !nlPanelRef.current.contains(event.target as Node)) {
        // Check if click is on the header input (allow it)
        if (nlInputRef.current && nlInputRef.current.contains(event.target as Node)) {
          return;
        }
        setShowNlPanel(false);
      }
    };

    if (showNlPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNlPanel]);

  // Auto-focus NL input in bottom sheet when opened
  useEffect(() => {
    if (showNlSheet && nlSheetInputRef.current) {
      setTimeout(() => nlSheetInputRef.current?.focus(), 100);
    }
  }, [showNlSheet]);

  // Track year header visibility with scroll position
  useEffect(() => {
    if (!isVisible) return;
    
    const setupScrollTracking = () => {
      // If refs aren't ready, try again
      if (!topRef.current || !scrollContainerRef.current) {
        return false;
      }
      
      // Find the scrollable parent container
      let container: HTMLElement | null = null;
      let element = scrollContainerRef.current;
      
      while (element) {
        const styles = window.getComputedStyle(element);
        if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
          container = element;
          break;
        }
        element = element.parentElement;
      }

      if (!container) {
        return true; // Don't retry if we can't find container
      }

      const handleScroll = () => {
        if (!topRef.current || !container) return;
        
        // Get the header's position relative to the scroll container
        const headerRect = topRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Header is visible if its bottom is below the container's top
        const headerVisible = headerRect.bottom > containerRect.top;
        
        setIsYearHeaderVisible(headerVisible);
      };
      
      // Initial check
      handleScroll();

      container.addEventListener('scroll', handleScroll);
      
      // Cleanup function
      return () => {
        container?.removeEventListener('scroll', handleScroll);
      };
    };

    // Try to setup immediately
    let cleanup = setupScrollTracking();
    
    // If it didn't work, retry a few times
    let attempts = 0;
    const maxAttempts = 5;
    const retryInterval = setInterval(() => {
      if (cleanup || attempts >= maxAttempts) {
        clearInterval(retryInterval);
        return;
      }
      
      attempts++;
      cleanup = setupScrollTracking();
    }, 100);

    return () => {
      clearInterval(retryInterval);
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [isVisible]);

  // Handle NL input submission (stub for now)
  const handleNlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlInput.trim()) return;
    console.log("NL submit (not wired yet)", nlInput);
    // Don't clear or close - just log for now
  };

  // Handle opening NL input from month header
  const handleOpenNlFromMonthHeader = () => {
    // On mobile, open bottom sheet
    if (window.innerWidth < 768) {
      setShowNlSheet(true);
    } else {
      // On desktop, open panel and focus input WITHOUT scrolling
      setShowNlPanel(true);
      setTimeout(() => {
        nlInputRef.current?.focus({ preventScroll: true });
      }, 100);
    }
  };

  // Unified scroll detection for both scroll-to-top button and month index
  useEffect(() => {
    if (!isVisible) return;
    
    // Wait for ref to be set
    if (!scrollContainerRef.current) {
      const timer = setTimeout(() => {}, 100);
      return () => clearTimeout(timer);
    }
    
    // Find scrollable container by traversing up (same as handleScrollToTop)
    let container: HTMLElement | null = null;
    let element = scrollContainerRef.current;
    
    while (element) {
      const styles = window.getComputedStyle(element);
      if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
        container = element;
        break;
      }
      element = element.parentElement;
    }

    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container!.scrollTop;
      const isScrolled = scrollTop > 100;
      
      // Show/hide scroll-to-top button
      setShowScrollTop(isScrolled);
      
      // Show month index on scroll, hide after 2s of inactivity
      if (isScrolled) {
        setShowMonthIndex(true);
        
        // Clear existing timeout
        if (monthIndexTimeoutRef.current) {
          clearTimeout(monthIndexTimeoutRef.current);
        }
        
        // Hide after 2 seconds of no scrolling
        monthIndexTimeoutRef.current = setTimeout(() => {
          setShowMonthIndex(false);
        }, 2000);
      } else {
        // At top - hide month index
        setShowMonthIndex(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state
    
    return () => {
      container?.removeEventListener('scroll', handleScroll);
      if (monthIndexTimeoutRef.current) {
        clearTimeout(monthIndexTimeoutRef.current);
      }
    };
  }, [isVisible, scrollContainerRef.current]);


  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return daysWithEvents.find(d => d.date === selectedDate);
  }, [selectedDate, daysWithEvents]);

  const handleScrollToTop = () => {
    // Find the scrollable container (div with overflow-y-auto that contains TopBanner + main)
    let scrollContainer: HTMLElement | null = null;
    
    // Start from our component and go up to find the overflow-y-auto div
    let element = scrollContainerRef.current;
    while (element) {
      const styles = window.getComputedStyle(element);
      if (styles.overflowY === 'auto' || styles.overflowY === 'scroll') {
        scrollContainer = element;
        break;
      }
      element = element.parentElement;
    }
    
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Today's date for highlighting
  const today = new Date().toISOString().split('T')[0];

  if (isLoading) {
    return (
      <div className={cn(tokens.layout.container, 'py-8')}>
        <div className="text-center text-neutral-400">Loading calendar...</div>
      </div>
    );
  }

  // Early return AFTER all hooks to prevent unnecessary rendering
  if (!isVisible) {
    return <div className="hidden" />;
  }

  return (
    <div ref={scrollContainerRef}>
      {/* Desktop layout: main list + right pane */}
      <div className="flex gap-4">
        {/* Main calendar list */}
        <div className={cn(
          'flex-1',
          selectedDate ? 'lg:w-2/3' : 'w-full'
        )}>
          {/* Header controls */}
          <div 
            ref={topRef} 
            className="pt-4 pb-6 border-b border-neutral-800"
          >
            {isPending && (
              <div className="absolute top-2 right-2 text-xs text-emerald-400 animate-pulse">
                Loading...
              </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Year selector - dropdown only, shows current ± 2 years */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => startTransition(() => setSelectedYear(Number(e.target.value)))}
                  className="text-xl font-semibold text-neutral-100 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-colors disabled:opacity-50"
                  disabled={isPending}
                >
                  {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(year => (
                    <option key={year} value={year} className="bg-neutral-900">
                      {year}
                    </option>
                  ))}
                </select>
                {selectedYear !== currentYear && (
                  <button
                    onClick={() => startTransition(() => setSelectedYear(currentYear))}
                    className={cn(tokens.button.secondary, 'text-xs px-2 py-1 ml-2')}
                    disabled={isPending}
                  >
                    Today
                  </button>
                )}
              </div>
              
              {/* Natural Language Input - Hidden on mobile */}
              <div className="hidden md:flex flex-1 max-w-2xl mx-4">
                <form onSubmit={handleNlSubmit} className="w-full relative">
                  <div className="relative">
                    <input
                      ref={nlInputRef}
                      type="text"
                      value={nlInput}
                      onChange={(e) => setNlInput(e.target.value)}
                      onFocus={() => setShowNlPanel(true)}
                      placeholder="Add an event with natural language..."
                      className="w-full px-4 py-2 pl-10 pr-4 bg-neutral-900 border border-neutral-700 rounded-full text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  </div>
                </form>
              </div>

              {/* Mobile: NL Input button - Shows on mobile */}
              <button
                onClick={() => setShowNlSheet(true)}
                className={cn(
                  'md:hidden',
                  tokens.button.ghost,
                  'p-2 text-emerald-400'
                )}
                title="Add event with natural language"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              
              {/* Settings button */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(tokens.button.ghost, 'p-2')}
                  title="Calendar settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                
                {/* Settings dropdown */}
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl p-4 z-40">
                    <h3 className="text-sm font-semibold text-neutral-100 mb-3">Calendar Settings</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={showPastMonths}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setShowPastMonths(newValue);
                            try {
                              localStorage.setItem('calendar-show-past-months', String(newValue));
                            } catch {}
                          }}
                          className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400"
                        />
                        <span>Show past months</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                        <input
                          type="checkbox"
                          checked={snapToToday}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setSnapToToday(newValue);
                            try {
                              localStorage.setItem('calendar-snap-to-today', String(newValue));
                            } catch {}
                            // Note: Don't scroll immediately when toggling - only on reload
                          }}
                          className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-400"
                        />
                        <span>Scroll to today on load</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: Expanded NL Panel */}
            {showNlPanel && (
              <div 
                ref={nlPanelRef}
                className="hidden md:block mt-4 bg-neutral-900/95 border border-neutral-700 rounded-xl p-6 shadow-2xl backdrop-blur-sm"
              >
                <form onSubmit={handleNlSubmit} className="space-y-4">
                  {/* NL Input (mirrored) */}
                  <div className="relative">
                    <input
                      type="text"
                      value={nlInput}
                      onChange={(e) => setNlInput(e.target.value)}
                      placeholder="Describe your event in natural language..."
                      className="w-full px-4 py-3 pl-10 pr-12 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      autoFocus
                    />
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="Submit"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Manual setup placeholder */}
                  <div className="pt-4 border-t border-neutral-700">
                    <h4 className="text-sm font-semibold text-neutral-300 mb-3">Manual setup</h4>
                    <div className="space-y-3 opacity-50">
                      <input
                        type="text"
                        placeholder="Event title"
                        disabled
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="date"
                          disabled
                          className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed"
                        />
                        <select
                          disabled
                          className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed"
                        >
                          <option>Category</option>
                        </select>
                      </div>
                      <textarea
                        placeholder="Notes"
                        disabled
                        rows={2}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed resize-none"
                      />
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Day rows grouped by month */}
          <div className="pb-24">
            {monthGroups.map((group, idx) => {
              const monthKey = `${group.year}-${String(group.monthIndex).padStart(2, '0')}`;
              const isExpanded = expandedMonths.has(monthKey);
              
              return (
              <div 
                key={`${group.year}-${group.monthIndex}-${group.days[0]?.date || idx}`} 
                id={`month-${group.year}-${group.monthIndex}`} 
                className={isExpanded && idx > 0 ? 'mt-4' : ''}
                style={{ scrollMarginTop: '80px' }} // Space for sticky header
              >
                {/* Month header - Clickable, sticky only when expanded */}
                <div 
                  className={cn(
                    'bg-neutral-950 -mx-6 px-6',
                    isExpanded ? 'pt-4 pb-3 mb-2 sticky top-0 z-10' : 'pt-1 pb-1'
                  )}
                >
                  <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl px-4 py-3 hover:bg-neutral-800/50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      {/* Month name - clickable area */}
                      <button
                        onClick={() => toggleMonth(group.year, group.monthIndex)}
                        className="flex-1 text-left"
                      >
                        <h2 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                          {group.monthName}
                        </h2>
                      </button>
                      
                      {/* NL input control - shown when year header is not visible AND month is expanded (sticky) */}
                      {!isYearHeaderVisible && isExpanded && (
                        <button
                          onClick={handleOpenNlFromMonthHeader}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-700/30 rounded-full text-xs font-medium text-emerald-300 transition-colors flex-shrink-0"
                          title="Add event with natural language"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Add with AI</span>
                        </button>
                      )}
                      
                      {/* Collapse/expand chevron - clickable */}
                      <button
                        onClick={() => toggleMonth(group.year, group.monthIndex)}
                        className="flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Day rows - only render if expanded */}
                {isExpanded && (
                  <div className="space-y-1" style={{ containIntrinsicSize: 'auto 80px' }}>
                    {group.days.map(day => {
                    const isSelected = selectedDate === day.date;
                    const hasEvents = day.events.length > 0;
                    const isToday = day.date === today;
                    
                    return (
                      <button
                        key={day.date}
                        ref={isToday ? todayRef : undefined}
                        onClick={() => handleDayClick(day.date)}
                        className={cn(
                          'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                          'hover:bg-neutral-800/50',
                          isSelected && 'bg-neutral-800 border-emerald-500',
                          !isSelected && day.isWeekend && 'bg-emerald-950/20 border-emerald-900/30',
                          !isSelected && !day.isWeekend && 'bg-neutral-900 border-neutral-800',
                          isToday && !isSelected && 'ring-2 ring-emerald-400/50',
                        )}
                        style={{ 
                          contentVisibility: 'auto',
                          scrollMarginTop: isToday ? '200px' : undefined // Space for 2-3 days above + sticky header
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'text-sm font-medium w-12',
                              day.isWeekend ? 'text-emerald-400' : 'text-neutral-400'
                            )}>
                              {day.dayOfWeek}
                            </span>
                            <span className={cn(
                              'text-lg font-semibold',
                              day.isWeekend ? 'text-emerald-300' : 'text-neutral-100'
                            )}>
                              {day.dayNumber}
                            </span>
                          </div>
                          
                          {hasEvents && (
                            <div className="flex items-center gap-2">
                              {day.events.slice(0, 3).map(event => {
                                const style = getCategoryStyle(event.category);
                                return (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      'px-2 py-1 rounded-md text-xs font-medium border',
                                      style.bg,
                                      style.text,
                                      style.border
                                    )}
                                  >
                                    {event.title}
                                  </div>
                                );
                              })}
                              {day.events.length > 3 && (
                                <span className="text-xs text-neutral-400">
                                  +{day.events.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {/* Month index (right side) - Vertically centered with background, auto-hide */}
        <div className={cn(
          'hidden md:block fixed right-6 top-1/2 -translate-y-1/2 z-20',
          'transition-opacity duration-300',
          showMonthIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          <div className="bg-neutral-900/95 border border-neutral-700 rounded-xl p-2 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col gap-0.5">
              {monthLabels.map(month => (
                <button
                  key={`${month.year}-${month.index}`}
                  onClick={() => scrollToMonth(month.index, month.year)}
                  className={cn(
                    'px-2 py-1.5 text-xs font-medium rounded-lg hover:bg-neutral-800 transition-colors',
                    'text-neutral-400 hover:text-neutral-100'
                  )}
                  title={month.fullName}
                >
                  {month.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop: Right detail pane */}
        {selectedDate && selectedDayData && (
          <div className="hidden lg:block w-1/3 flex-shrink-0 sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-auto">
            <DayDetailPane
              dayData={selectedDayData}
              onClose={handleCloseDetail}
              isCreating={isCreating}
              editingEvent={editingEvent}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              onSaveEvent={handleSaveEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          </div>
        )}
      </div>

      {/* Mobile: Bottom sheet for day details */}
      {selectedDate && selectedDayData && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" onClick={handleCloseDetail}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-h-[80vh] bg-neutral-900 rounded-t-2xl border-t border-neutral-800 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <DayDetailPane
              dayData={selectedDayData}
              onClose={handleCloseDetail}
              isCreating={isCreating}
              editingEvent={editingEvent}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              onSaveEvent={handleSaveEvent}
              onDeleteEvent={handleDeleteEvent}
            />
          </div>
        </div>
      )}

      {/* Mobile: Bottom sheet for NL input */}
      {showNlSheet && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setShowNlSheet(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-h-[90vh] bg-neutral-900 rounded-t-2xl border-t border-neutral-800 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
              <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
                Add Event
              </h3>
              <button
                onClick={() => setShowNlSheet(false)}
                className={cn(tokens.button.ghost, 'p-2')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <form onSubmit={handleNlSubmit} className="space-y-4">
                {/* NL Input */}
                <div className="relative">
                  <input
                    ref={nlSheetInputRef}
                    type="text"
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    placeholder="Describe your event in natural language..."
                    className="w-full px-4 py-3 pl-10 pr-12 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                    title="Submit"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Manual setup placeholder */}
                <div className="pt-4 border-t border-neutral-700">
                  <h4 className="text-sm font-semibold text-neutral-300 mb-3">Manual setup</h4>
                  <div className="space-y-3 opacity-50">
                    <input
                      type="text"
                      placeholder="Event title"
                      disabled
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        disabled
                        className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed"
                      />
                      <select
                        disabled
                        className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed"
                      >
                        <option>Category</option>
                      </select>
                    </div>
                    <textarea
                      placeholder="Notes"
                      disabled
                      rows={3}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-400 cursor-not-allowed resize-none"
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button - Auto-hide with fade */}
      <button
        onClick={handleScrollToTop}
        className={cn(
          'fixed bottom-6 right-6 z-[9999] p-3 bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl shadow-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-neutral-500',
          showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-label="Scroll to top"
        title="Scroll to top"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
    </div>
  );
};

// Day detail pane component (reused for desktop right pane and mobile bottom sheet)
interface DayDetailPaneProps {
  dayData: DayData;
  onClose: () => void;
  isCreating: boolean;
  editingEvent: CalendarEvent | null;
  onCreateEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSaveEvent: (input: CalendarEventInput, eventId?: string) => void;
  onDeleteEvent: (eventId: string) => void;
}

const DayDetailPane: React.FC<DayDetailPaneProps> = ({
  dayData,
  onClose,
  isCreating,
  editingEvent,
  onCreateEvent,
  onEditEvent,
  onSaveEvent,
  onDeleteEvent,
}) => {
  const [formData, setFormData] = useState<CalendarEventInput>({
    date: dayData.date,
    title: '',
    category: null,
    notes: null,
  });

  useEffect(() => {
    if (editingEvent) {
      setFormData({
        date: editingEvent.date,
        title: editingEvent.title,
        category: editingEvent.category,
        notes: editingEvent.notes,
      });
    } else {
      setFormData({
        date: dayData.date,
        title: '',
        category: null,
        notes: null,
      });
    }
  }, [editingEvent, dayData.date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSaveEvent(formData, editingEvent?.id);
  };

  const dateDisplay = new Date(dayData.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
        <div>
          <h3 className={cn(tokens.typography.scale.h3, tokens.typography.weights.semibold, tokens.palette.dark.text)}>
            {dateDisplay}
          </h3>
          <p className="text-sm text-neutral-400 mt-1">
            {dayData.events.length} {dayData.events.length === 1 ? 'event' : 'events'}
          </p>
        </div>
        <button
          onClick={onClose}
          className={cn(tokens.button.ghost, 'p-2')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Create/Edit form */}
        {(isCreating || editingEvent) && (
          <form onSubmit={handleSubmit} className={cn(tokens.card.base, 'space-y-3')}>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={cn(tokens.input.base, tokens.input.focus)}
                placeholder="Event title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Category
              </label>
              <select
                value={formData.category || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value || null }))}
                className={cn(tokens.select.base)}
              >
                <option value="">None</option>
                <option value="travel">Travel</option>
                <option value="medical">Medical</option>
                <option value="social">Social</option>
                <option value="work">Work</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value || null }))}
                className={cn(tokens.input.base, tokens.input.focus, 'min-h-[80px] resize-y')}
                placeholder="Additional details..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className={cn(tokens.button.primary, 'flex-1')}
              >
                {editingEvent ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onEditEvent(null as any);
                  onClose();
                }}
                className={cn(tokens.button.secondary)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Add event button (when not creating/editing) */}
        {!isCreating && !editingEvent && (
          <button
            onClick={onCreateEvent}
            className={cn(tokens.button.primary, 'w-full')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Event
          </button>
        )}

        {/* Events list */}
        <div className="space-y-3">
          {dayData.events.map(event => {
            const style = getCategoryStyle(event.category);
            const isEditing = editingEvent?.id === event.id;
            
            if (isEditing) return null; // Hide when editing
            
            return (
              <div
                key={event.id}
                className={cn(
                  'p-4 rounded-lg border',
                  style.bg,
                  style.border
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className={cn('font-semibold', style.text)}>
                      {event.title}
                    </h4>
                    {event.category && (
                      <p className="text-xs text-neutral-400 mt-1">
                        {event.category}
                      </p>
                    )}
                    {event.notes && (
                      <p className="text-sm text-neutral-300 mt-2">
                        {event.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditEvent(event)}
                      className={cn(tokens.button.ghost, 'p-2')}
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteEvent(event.id)}
                      className={cn(tokens.button.ghost, 'p-2 text-rose-400 hover:text-rose-300')}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {dayData.events.length === 0 && !isCreating && (
            <div className="text-center py-8 text-neutral-400">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No events on this day</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarTab;

