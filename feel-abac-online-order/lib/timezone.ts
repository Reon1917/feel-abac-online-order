/**
 * Centralized timezone utilities for Bangkok (Asia/Bangkok, UTC+7).
 * All order dates should use Bangkok timezone for consistency.
 */

export const BANGKOK_TIMEZONE = "Asia/Bangkok";

/**
 * Get current date in Bangkok timezone as YYYY-MM-DD string.
 */
export function getBangkokDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BANGKOK_TIMEZONE });
}

/**
 * Get current datetime in Bangkok timezone as ISO string.
 */
export function getBangkokNow(): Date {
  // Return current time - the timezone handling is done at display/query level
  return new Date();
}

/**
 * Convert a PostgreSQL DATE value to YYYY-MM-DD string.
 * 
 * Neon HTTP driver can return dates in various formats:
 * - As a string "YYYY-MM-DD" 
 * - As a Date object (interpreted as UTC midnight)
 * - As a string with time "YYYY-MM-DDTHH:mm:ss.sssZ"
 * 
 * This function normalizes all formats to YYYY-MM-DD.
 * 
 * @param value - Date from Drizzle/Neon (could be Date object or string)
 * @returns YYYY-MM-DD string
 */
export function pgDateToString(value: Date | string | null | undefined): string {
  if (!value) return "";
  
  if (typeof value === "string") {
    // Could be "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..."
    // Just take the first 10 characters (the date part)
    const dateStr = value.slice(0, 10);
    
    // Validate it looks like a date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Fallback: try parsing and extracting
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      // Use local date parts since the string might have timezone info
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    
    return "";
  }
  
  // It's a Date object
  // Neon might return it as UTC midnight for the stored date
  // Use UTC methods to get the stored date without local timezone conversion
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string (YYYY-MM-DD) for display as a day header.
 * 
 * @param dateStr - YYYY-MM-DD string
 * @param locale - Locale for formatting (default: en-TH)
 * @returns Formatted date string like "Wednesday, November 26, 2025"
 */
export function formatDateHeader(dateStr: string, locale = "en-TH"): string {
  if (!dateStr) return "";
  
  // Parse as UTC to avoid timezone shifts
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // noon UTC to avoid edge cases
  
  if (Number.isNaN(date.getTime())) return dateStr;
  
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC", // Format in UTC since we stored it that way
  }).format(date);
}

/**
 * Format a timestamp for display in Bangkok timezone.
 * 
 * @param value - ISO timestamp string or Date
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted datetime string
 */
export function formatBangkokTimestamp(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  }
): string {
  if (!value) return "-";
  
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  
  return new Intl.DateTimeFormat("en-TH", {
    ...options,
    timeZone: BANGKOK_TIMEZONE,
  }).format(date);
}

/**
 * Check if a date string (YYYY-MM-DD) is today in Bangkok timezone.
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getBangkokDateString();
}
