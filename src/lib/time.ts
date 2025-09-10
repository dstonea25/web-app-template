// Time utilities for timer functionality and formatting
export const nowIso = (): string => {
  return new Date().toISOString();
};

export const msToHms = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const computeDurationMs = (startedAt: string, endedAt?: string): number => {
  const startTime = new Date(startedAt);
  const endTime = endedAt ? new Date(endedAt) : new Date();
  return endTime.getTime() - startTime.getTime();
};

export const formatDateTime = (isoString: string): string => {
  return new Date(isoString).toLocaleString();
};

export const formatDateTimeLocal = (isoString: string): string => {
  return isoString.slice(0, 16); // YYYY-MM-DDTHH:MM format for datetime-local inputs
};

export const parseDateTimeLocal = (localString: string): string => {
  return new Date(localString).toISOString();
};

