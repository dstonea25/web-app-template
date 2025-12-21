import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useTransition, useDeferredValue } from 'react';
import { tokens, cn } from '../theme/config';
import { Calendar, X, Plus, Edit2, Trash2, Settings, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { apiClient } from '../lib/api';
import { toast } from '../lib/notifications/toast';
import type { CalendarEvent, CalendarEventInput } from '../types';

interface CalendarTabProps {
  isVisible?: boolean;
}

// Category colors for event pills (dot + text)
const CATEGORY_COLORS: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  vacation: { dot: 'bg-purple-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  holiday: { dot: 'bg-rose-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  travel: { dot: 'bg-teal-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  medical: { dot: 'bg-orange-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  social: { dot: 'bg-amber-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  work: { dot: 'bg-blue-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
  personal: { dot: 'bg-neutral-500', text: 'text-neutral-200', bg: 'bg-neutral-800/60', border: 'border-neutral-700' },
};

// Row appearance colors (ONLY for PTO, Travel, and Weekends)
const ROW_COLORS: Record<string, { bg: string; border: string }> = {
  pto: { bg: 'bg-yellow-950/40', border: 'border-yellow-700/50' },  // Golden for PTO
  travel: { bg: 'bg-teal-950/30', border: 'border-teal-800/40' },   // Teal for travel
  weekend: { bg: 'bg-emerald-950/20', border: 'border-emerald-900/30' }, // Emerald for weekends
  default: { bg: 'bg-neutral-900', border: 'border-neutral-800' },
};

// Priority values - ONLY for row appearance (PTO, Travel, Weekend)
const PRIORITY_VALUES: Record<string, number> = {
  pto: 10,      // PTO always wins
  travel: 7,    // Travel
  weekend: 5,   // Baseline special day
  default: 1,
};

const getCategoryStyle = (category: string | null | undefined) => {
  if (!category) return CATEGORY_COLORS.personal;
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.personal;
};

const getDefaultPriority = (category: string | null): number => {
  // Only travel gets default affects_row_appearance
  if (category?.toLowerCase() === 'travel') return PRIORITY_VALUES.travel;
  return PRIORITY_VALUES.default;
};

interface RowAppearance {
  bg: string;
  border: string;
  hasPto: boolean;  // Whether to show gold dot indicator
  ptoOnly: boolean; // Whether this is PTO-only (golden background)
}

const getRowAppearance = (day: DayData): RowAppearance => {
  // Check for PTO events
  const ptoEvents = day.events.filter(e => e.is_pto);
  const travelEvents = day.events.filter(e => e.category?.toLowerCase() === 'travel' && e.affects_row_appearance);
  
  const hasPto = ptoEvents.length > 0;
  const hasTravel = travelEvents.length > 0;
  
  // Priority: PTO > Travel > Weekend > Default
  
  // If PTO exists → Golden row
  if (hasPto) {
    return {
      ...ROW_COLORS.pto,
      hasPto: true,
      ptoOnly: !hasTravel, // Show if not combined with travel
    };
  }
  
  // If Travel exists → Teal row
  if (hasTravel) {
    return {
      ...ROW_COLORS.travel,
      hasPto: false,
      ptoOnly: false,
    };
  }
  
  // If Weekend → Emerald row
  if (day.isWeekend) {
    return {
      ...ROW_COLORS.weekend,
      hasPto: false,
      ptoOnly: false,
    };
  }
  
  // Default (no special row color)
  return {
    ...ROW_COLORS.default,
    hasPto: false,
    ptoOnly: false,
  };
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
  const [activeMonthDropdown, setActiveMonthDropdown] = useState<string | null>(null); // Which month's dropdown is open
  const [manualEntryType, setManualEntryType] = useState<'single' | 'multi' | 'pattern'>('single'); // Type of manual entry
  
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

  // Map events to days (handling multi-day events)
  const daysWithEvents = useMemo(() => {
    const eventsByDate = new Map<string, CalendarEvent[]>();
    
    // For each event, map it to all days it spans
    events.forEach(event => {
      const startDate = parseLocalDate(event.start_date);
      const endDate = parseLocalDate(event.end_date);
      
      // Iterate through each day in the event's range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const existing = eventsByDate.get(dateStr) || [];
        existing.push(event);
        eventsByDate.set(dateStr, existing);
        currentDate.setDate(currentDate.getDate() + 1);
      }
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
        // Merge updates into existing event
        setEvents(prev => prev.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              ...input,
              updated_at: new Date().toISOString(),
            };
          }
          return e;
        }));
        toast.success('Event updated');
      } else {
        // Create new
        const newId = await apiClient.createCalendarEvent(input);
        const newEvent: CalendarEvent = {
          id: newId,
          title: input.title,
          category: input.category,
          notes: input.notes,
          start_date: input.start_date,
          end_date: input.end_date,
          start_time: input.start_time,
          end_time: input.end_time,
          all_day: input.all_day,
          affects_row_appearance: input.affects_row_appearance,
          priority: input.priority,
          is_pto: input.is_pto,
          source_pattern_id: input.source_pattern_id,
          user_id: null,
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

  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTimeoutId, setDeleteTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleDeleteEvent = async (eventId: string) => {
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) return;
    
    // Optimistically remove from UI
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setDeletingEvent(eventToDelete);
    setEditingEvent(null);
    
    // Show undo toast
    const undoToast = toast.success(
      <div className="flex items-center justify-between gap-4">
        <span>Event deleted</span>
        <button
          onClick={() => handleUndoDelete()}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium transition-colors"
        >
          Undo
        </button>
      </div>,
      { duration: 8000 }  // 8 second window to undo
    );
    
    // Set timeout to actually delete from DB after 8 seconds
    const timeoutId = setTimeout(async () => {
      try {
        await apiClient.deleteCalendarEvent(eventId);
        setDeletingEvent(null);
        // Toast already shown
      } catch (error) {
        console.error('Failed to delete event:', error);
        // Restore event if DB delete failed
        setEvents(prev => [...prev, eventToDelete]);
        toast.error('Failed to delete event');
      }
    }, 8000);
    
    setDeleteTimeoutId(timeoutId);
  };

  const handleUndoDelete = () => {
    if (!deletingEvent) return;
    
    // Cancel the delete timeout
    if (deleteTimeoutId) {
      clearTimeout(deleteTimeoutId);
      setDeleteTimeoutId(null);
    }
    
    // Restore event to UI
    setEvents(prev => [...prev, deletingEvent]);
    setDeletingEvent(null);
    
    toast.success('Deletion undone');
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutId) {
        clearTimeout(deleteTimeoutId);
      }
    };
  }, [deleteTimeoutId]);

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

  // Handle NL input submission
  const handleNlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlInput.trim()) return;
    
    try {
      // Parse natural language to structured event
      const parsedEvent = await apiClient.parseNaturalLanguageEvent(nlInput);
      
      // Create the event in Supabase
      const newId = await apiClient.createCalendarEvent(parsedEvent);
      
      // Add to local state
      const newEvent: CalendarEvent = {
        id: newId,
        ...parsedEvent,
        user_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setEvents(prev => [...prev, newEvent]);
      
      // Success!
      toast.success(`Created: ${parsedEvent.title}`);
      setNlInput('');
      setShowNlPanel(false);
    } catch (error: any) {
      console.error('Failed to create event from NL:', error);
      toast.error(error.message || 'Could not understand event. Try manual entry.');
    }
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

                  {/* Manual setup - functional */}
                  <div className="pt-4 border-t border-neutral-700">
                    <h4 className="text-sm font-semibold text-neutral-300 mb-3">Manual setup</h4>
                    
                    {/* Type selector */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setManualEntryType('single')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                          manualEntryType === 'single'
                            ? 'bg-emerald-900/30 border-2 border-emerald-600 text-emerald-300'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                        )}
                      >
                        📅 Single Event
                      </button>
                      <button
                        onClick={() => setManualEntryType('multi')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                          manualEntryType === 'multi'
                            ? 'bg-emerald-900/30 border-2 border-emerald-600 text-emerald-300'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                        )}
                      >
                        📆 Multi-Day
                      </button>
                      <button
                        onClick={() => setManualEntryType('pattern')}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                          manualEntryType === 'pattern'
                            ? 'bg-emerald-900/30 border-2 border-emerald-600 text-emerald-300'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                        )}
                      >
                        🔁 Pattern
                      </button>
                    </div>

                    {/* Dynamic form based on type */}
                    <div className="space-y-3">
                      {/* Common fields for events */}
                      {(manualEntryType === 'single' || manualEntryType === 'multi') && (
                        <>
                          <input
                            type="text"
                            placeholder="Event title"
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          
                          <div className="grid grid-cols-2 gap-3">
                            {manualEntryType === 'single' ? (
                              <input
                                type="date"
                                placeholder="Date"
                                className="col-span-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            ) : (
                              <>
                                <input
                                  type="date"
                                  placeholder="Start date"
                                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <input
                                  type="date"
                                  placeholder="End date"
                                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </>
                            )}
                          </div>

                          <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="">Select category...</option>
                            <option value="vacation">🏖️ Vacation</option>
                            <option value="holiday">🎉 Holiday</option>
                            <option value="travel">✈️ Travel</option>
                            <option value="medical">🏥 Medical</option>
                            <option value="social">👥 Social</option>
                            <option value="work">💼 Work</option>
                            <option value="personal">📌 Personal</option>
                          </select>

                          <div className="flex gap-3">
                            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                              <input type="checkbox" className="w-3 h-3 rounded border-neutral-700 bg-neutral-900 text-emerald-500" />
                              <span>All-day</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                              <input type="checkbox" className="w-3 h-3 rounded border-neutral-700 bg-neutral-900 text-yellow-500" />
                              <span>PTO 🟡</span>
                            </label>
                          </div>

                          <button className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors">
                            Create Event
                          </button>
                        </>
                      )}

                      {/* Pattern-specific fields */}
                      {manualEntryType === 'pattern' && (
                        <>
                          <input
                            type="text"
                            placeholder="Pattern name (e.g., Weekly Team Meeting)"
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />

                          <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="">Pattern type...</option>
                            <option value="recurring">🔁 Recurring (repeats regularly)</option>
                            <option value="goal">🎯 Goal (target count by date)</option>
                            <option value="template">📋 Template (one-off)</option>
                          </select>

                          <input
                            type="text"
                            placeholder="Frequency (e.g., Every Monday, Weekly, Monthly)"
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="date"
                              placeholder="Start date"
                              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <input
                              type="date"
                              placeholder="End date (optional)"
                              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                            <p className="text-xs text-amber-300">
                              ⚠️ Pattern creation stores the rule. Events will be generated by automation (coming soon).
                            </p>
                          </div>

                          <button className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors">
                            Create Pattern
                          </button>
                        </>
                      )}
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
                      
                      {/* Add button - shown when year header is not visible AND month is expanded (sticky) */}
                      {!isYearHeaderVisible && isExpanded && (
                        <button
                          onClick={() => {
                            setActiveMonthDropdown(activeMonthDropdown === monthKey ? null : monthKey);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-900/20 hover:bg-emerald-900/30 border border-emerald-700/30 rounded-full text-xs font-medium text-emerald-300 transition-colors flex-shrink-0"
                          title="Add event"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Add</span>
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

                {/* Dropdown Module - appears below sticky month header */}
                {activeMonthDropdown === monthKey && isExpanded && (
                  <div className="bg-neutral-900/98 border border-neutral-700 rounded-xl p-5 mx-4 mb-3 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-semibold text-neutral-100">Add to {group.monthName}</h4>
                      <button
                        onClick={() => setActiveMonthDropdown(null)}
                        className="p-1 hover:bg-neutral-800 rounded transition-colors"
                      >
                        <X className="w-5 h-5 text-neutral-400" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* AI Input Section */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                          Natural Language
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="e.g., Doctor appointment next Tuesday at 2pm"
                            className="w-full px-4 py-2.5 pl-10 pr-4 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                const nlText = e.currentTarget.value;
                                try {
                                  const parsedEvent = await apiClient.parseNaturalLanguageEvent(nlText);
                                  const newId = await apiClient.createCalendarEvent(parsedEvent);
                                  const newEvent: CalendarEvent = {
                                    id: newId,
                                    ...parsedEvent,
                                    user_id: null,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                  };
                                  setEvents(prev => [...prev, newEvent]);
                                  toast.success(`Created: ${parsedEvent.title}`);
                                  setActiveMonthDropdown(null);
                                } catch (error: any) {
                                  console.error('Failed to create event:', error);
                                  toast.error(error.message || 'Could not parse event');
                                }
                              }
                            }}
                            autoFocus
                          />
                          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-xs text-neutral-500 mt-1.5">Press Enter to create with AI</p>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-neutral-700"></div>
                        <span className="text-xs text-neutral-500">OR</span>
                        <div className="flex-1 h-px bg-neutral-700"></div>
                      </div>

                      {/* Manual Entry Section - Same as NL panel */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                          Manual Entry
                        </label>
                        
                        {/* Type selector */}
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => setManualEntryType('single')}
                            className={cn(
                              'flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                              manualEntryType === 'single'
                                ? 'bg-emerald-900/30 border-2 border-emerald-600 text-emerald-300'
                                : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                            )}
                          >
                            📅 Single
                          </button>
                          <button
                            onClick={() => setManualEntryType('multi')}
                            className={cn(
                              'flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                              manualEntryType === 'multi'
                                ? 'bg-emerald-900/30 border-2 border-emerald-600 text-emerald-300'
                                : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                            )}
                          >
                            📆 Multi-Day
                          </button>
                          <button
                            onClick={() => setManualEntryType('pattern')}
                            className={cn(
                              'flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                              manualEntryType === 'pattern'
                                ? 'bg-emerald-900/30 border-2 border-emerald-600 text-emerald-300'
                                : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700'
                            )}
                          >
                            🔁 Pattern
                          </button>
                        </div>

                        {/* Dynamic form based on type - prefilled with first day of month */}
                        <div className="space-y-2.5">
                          {(manualEntryType === 'single' || manualEntryType === 'multi') && (
                            <>
                              <input
                                type="text"
                                placeholder="Event title"
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              
                              <div className="grid grid-cols-2 gap-2">
                                {manualEntryType === 'single' ? (
                                  <input
                                    type="date"
                                    defaultValue={group.days[0]?.date}
                                    className="col-span-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                ) : (
                                  <>
                                    <input
                                      type="date"
                                      placeholder="Start"
                                      defaultValue={group.days[0]?.date}
                                      className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <input
                                      type="date"
                                      placeholder="End"
                                      defaultValue={group.days[0]?.date}
                                      className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </>
                                )}
                              </div>

                              <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="">Category...</option>
                                <option value="vacation">🏖️ Vacation</option>
                                <option value="holiday">🎉 Holiday</option>
                                <option value="travel">✈️ Travel</option>
                                <option value="medical">🏥 Medical</option>
                                <option value="social">👥 Social</option>
                                <option value="work">💼 Work</option>
                                <option value="personal">📌 Personal</option>
                              </select>

                              <div className="flex gap-3 text-xs">
                                <label className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
                                  <input type="checkbox" className="w-3 h-3 rounded" defaultChecked />
                                  All-day
                                </label>
                                <label className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
                                  <input type="checkbox" className="w-3 h-3 rounded" />
                                  PTO 🟡
                                </label>
                              </div>

                              <button className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white transition-colors">
                                Create Event
                              </button>
                            </>
                          )}

                          {manualEntryType === 'pattern' && (
                            <>
                              <input
                                type="text"
                                placeholder="Pattern name"
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option>Pattern type...</option>
                                <option value="recurring">🔁 Recurring</option>
                                <option value="goal">🎯 Goal</option>
                                <option value="template">📋 Template</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Frequency"
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <button className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white transition-colors">
                                Create Pattern
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Day rows - only render if expanded */}
                {isExpanded && (
                  <div className="space-y-1" style={{ containIntrinsicSize: 'auto 80px' }}>
                    {group.days.map(day => {
                    const isSelected = selectedDate === day.date;
                    const hasEvents = day.events.length > 0;
                    const isToday = day.date === today;
                    const rowAppearance = getRowAppearance(day);
                    
                    return (
                      <div
                        key={day.date}
                        className="group/day relative"
                        style={{ 
                          contentVisibility: 'auto',
                        }}
                      >
                        <button
                          ref={isToday ? todayRef : undefined}
                          onClick={() => handleDayClick(day.date)}
                          className={cn(
                            'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                            'hover:bg-neutral-800/50',
                            isSelected && 'bg-neutral-800 border-emerald-500',
                            !isSelected && rowAppearance.bg,
                            !isSelected && rowAppearance.border,
                            isToday && !isSelected && 'ring-2 ring-emerald-400/50',
                          )}
                          style={{ 
                            scrollMarginTop: isToday ? '200px' : undefined // Space for 2-3 days above + sticky header
                          }}
                        >
                        <div className="flex items-center gap-3">
                          {/* Date info */}
                          <div className="flex items-center gap-3 flex-shrink-0">
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
                            {/* Gold PTO indicator dot */}
                            {rowAppearance.hasPto && !rowAppearance.ptoOnly && (
                              <span 
                                className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-300 shadow-sm"
                                title="PTO day"
                              />
                            )}
                          </div>
                          
                          {/* Event pills - left-aligned */}
                          {hasEvents && (
                            <div className="flex items-center gap-2 flex-wrap flex-1">
                              {day.events.slice(0, 3).map(event => {
                                const style = getCategoryStyle(event.category);
                                return (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border cursor-pointer',
                                      'hover:bg-neutral-700/50 transition-all',
                                      style.bg,
                                      style.border
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditEvent(event);
                                    }}
                                  >
                                    {/* Colored dot */}
                                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', style.dot)} />
                                    {/* Event name */}
                                    <span className={cn('truncate max-w-[100px]', style.text)}>{event.title}</span>
                                    {/* Delete X - white/light colored for visibility */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEvent(event.id);
                                      }}
                                      className="text-neutral-400 opacity-70 group-hover:opacity-100 hover:text-rose-400 transition-all ml-0.5"
                                      title="Delete event"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
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
                        
                        {/* Quick Add Button (shows on hover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(day.date);
                            setIsCreating(true);
                            setEditingEvent(null);
                          }}
                          className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2',
                            'opacity-0 group-hover/day:opacity-100',
                            'p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full',
                            'transition-all shadow-lg hover:scale-110',
                            'z-10'
                          )}
                          title="Quick add event"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
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
    title: '',
    category: null,
    notes: null,
    start_date: dayData.date,
    end_date: dayData.date,
    start_time: null,
    end_time: null,
    all_day: true,
    affects_row_appearance: false,
    priority: 5,
    is_pto: false,
    source_pattern_id: null,
  });

  useEffect(() => {
    if (editingEvent) {
      setFormData({
        title: editingEvent.title,
        category: editingEvent.category,
        notes: editingEvent.notes,
        start_date: editingEvent.start_date,
        end_date: editingEvent.end_date,
        start_time: editingEvent.start_time,
        end_time: editingEvent.end_time,
        all_day: editingEvent.all_day,
        affects_row_appearance: editingEvent.affects_row_appearance,
        priority: editingEvent.priority,
        is_pto: editingEvent.is_pto,
        source_pattern_id: editingEvent.source_pattern_id,
      });
    } else {
      setFormData({
        title: '',
        category: null,
        notes: null,
        start_date: dayData.date,
        end_date: dayData.date,
        start_time: null,
        end_time: null,
        all_day: true,
        affects_row_appearance: false,
        priority: 5,
        is_pto: false,
        source_pattern_id: null,
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
          <form onSubmit={handleSubmit} className={cn(tokens.card.base, 'space-y-4')}>
            {/* Section: Basic Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Basic Information</h4>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={cn(tokens.input.base, tokens.input.focus, 'text-base')}
                  placeholder="e.g., Team Meeting, Doctor Appointment"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Category
                </label>
                <select
                  value={formData.category || ''}
                onChange={(e) => {
                  const newCategory = e.target.value || null;
                  const newPriority = getDefaultPriority(newCategory);
                  // Only travel affects row appearance by default
                  const shouldAffectRow = newCategory?.toLowerCase() === 'travel';
                  setFormData(prev => ({ 
                    ...prev, 
                    category: newCategory,
                    priority: newPriority,
                    affects_row_appearance: shouldAffectRow
                  }));
                }}
                  className={cn(tokens.select.base, 'text-base')}
                >
                  <option value="">Select category...</option>
                  <option value="vacation">🏖️ Vacation</option>
                  <option value="holiday">🎉 Holiday</option>
                  <option value="travel">✈️ Travel</option>
                  <option value="medical">🏥 Medical</option>
                  <option value="social">👥 Social</option>
                  <option value="work">💼 Work</option>
                  <option value="personal">📌 Personal</option>
                </select>
              </div>
            </div>

            {/* Section: Date & Time */}
            <div className="space-y-3 pt-4 border-t border-neutral-700">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Date & Time</h4>
              
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      start_date: e.target.value,
                      // Auto-update end_date if it's before start_date
                      end_date: prev.end_date < e.target.value ? e.target.value : prev.end_date
                    }))}
                    className={cn(tokens.input.base, tokens.input.focus)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    min={formData.start_date}
                    className={cn(tokens.input.base, tokens.input.focus)}
                    required
                  />
                </div>
              </div>

              {/* All-Day Toggle */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.all_day}
                    onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked }))}
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  />
                  <span>All-day event</span>
                </label>

                {/* PTO Toggle */}
                <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.is_pto}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_pto: e.target.checked }))}
                    className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-yellow-500 focus:ring-2 focus:ring-yellow-500"
                  />
                  <span className="flex items-center gap-1">
                    PTO
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  </span>
                </label>
              </div>
            </div>

            {/* Time inputs (only if not all-day) */}
            {!formData.all_day && (
              <div className="space-y-3 pt-3 border-t border-neutral-700/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={formData.start_time || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value || null }))}
                      className={cn(tokens.input.base, tokens.input.focus)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={formData.end_time || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value || null }))}
                      className={cn(tokens.input.base, tokens.input.focus)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section: Display Options */}
            <div className="space-y-3 pt-4 border-t border-neutral-700">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Display Options</h4>
              
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer hover:text-neutral-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.affects_row_appearance}
                  onChange={(e) => setFormData(prev => ({ ...prev, affects_row_appearance: e.target.checked }))}
                  className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
                />
                <span>Change calendar row color</span>
              </label>

              {formData.affects_row_appearance && (
                <div className="pl-6 space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    Priority: <span className="text-emerald-400 font-semibold">{formData.priority}</span>
                    <span className="text-xs text-neutral-500 ml-2">(Higher priority wins color conflicts)</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Low (1)</span>
                    <span>High (10)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Notes */}
            <div className="space-y-3 pt-4 border-t border-neutral-700">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Notes</h4>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value || null }))}
                className={cn(tokens.input.base, tokens.input.focus, 'min-h-[100px] resize-y')}
                placeholder="Add any additional details, reminders, or context..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className={cn(tokens.button.primary, 'flex-1 py-3 font-semibold')}
              >
                {editingEvent ? '✓ Update Event' : '+ Create Event'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onEditEvent(null as any);
                  onClose();
                }}
                className={cn(tokens.button.secondary, 'px-6 py-3')}
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
                    
                    <div className="space-y-1 mt-2">
                      {/* Date range display */}
                      {event.start_date !== event.end_date ? (
                        <p className="text-xs text-neutral-400">
                          {new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                          {' → '}
                          {new Date(event.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      ) : !event.all_day && event.start_time && (
                        <p className="text-xs text-neutral-400">
                          {event.start_time.slice(0, 5)}
                          {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                        </p>
                      )}
                      
                      {/* Category & PTO indicator */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {event.category && (
                          <p className="text-xs text-neutral-400">
                            {event.category}
                            {event.affects_row_appearance && ` • Priority ${event.priority}`}
                          </p>
                        )}
                        {event.is_pto && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-950/40 border border-yellow-700/50 rounded text-xs text-yellow-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            PTO
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Notes */}
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

