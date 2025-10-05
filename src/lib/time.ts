// Time utilities for timer functionality and formatting
export const nowIso = (): string => {
  return new Date().toISOString();
};

// Maximum allowed running timer duration
export const MAX_TIMER_HOURS = 6;
export const MAX_TIMER_MINUTES = MAX_TIMER_HOURS * 60;
export const MAX_TIMER_MS = MAX_TIMER_MINUTES * 60 * 1000;

// Convert minutes to HH:MM format
export const minutesToHhMm = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Convert HH:MM format to minutes
export const hhMmToMinutes = (hhMm: string): number => {
  const [hours, minutes] = hhMm.split(':').map(Number);
  return (hours * 60) + minutes;
};

// Convert milliseconds to dynamic timer display format
export const msToTimerDisplay = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

// Convert milliseconds to HH:MM:SS format for timer display (legacy)
export const msToHms = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Convert milliseconds to hours and minutes only (for stopped timer display)
export const msToHm = (ms: number): string => {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Compute duration in minutes between two ISO strings
export const computeDurationMinutes = (startedAt: string, endedAt: string): number => {
  const startTime = new Date(startedAt);
  const endTime = new Date(endedAt);
  return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
};

// Format date for display
export const formatDate = (isoString: string): string => {
  return new Date(isoString).toLocaleDateString();
};

// Format date and time for display
export const formatDateTime = (isoString: string): string => {
  return new Date(isoString).toLocaleString();
};

// Get date at midnight local time
export const getDateAtMidnight = (date: string | Date): string => {
  // If the input is a date string like "2025-09-18", we need to handle it as a local date
  // rather than letting JavaScript interpret it as UTC
  let localDate: Date;
  
  if (typeof date === 'string' || date instanceof Date) {
    // Check if this looks like a date string (YYYY-MM-DD format)
    const dateStr = date.toString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Parse as local date by creating a date with explicit local timezone
      const [year, month, day] = dateStr.split('-').map(Number);
      localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      // Use the date as-is for other formats
      localDate = new Date(date);
      localDate.setHours(0, 0, 0, 0);
    }
  } else {
    localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
  }
  
  return localDate.toISOString();
};

// Add minutes to a date
export const addMinutes = (isoString: string, minutes: number): string => {
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};

// Generate a simple ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

