import { TimeFormat, RoundingType } from "@shared/schema";

/**
 * Formats seconds into HH:MM:SS format
 * @param seconds - Time in seconds
 * @returns Formatted time string
 */
export function formatSeconds(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format decimal hours to either decimal or time format
 * @param hours - Time in decimal hours
 * @param format - Output format: 'decimal' or 'time'
 * @returns Formatted time string
 */
export function formatTime(hours: number | string, format: TimeFormat): string {
  // Convert string to number if needed
  const hoursNum = typeof hours === 'string' ? parseFloat(hours) : hours;
  
  if (isNaN(hoursNum)) {
    return format === 'decimal' ? '0.0' : '00:00:00';
  }
  
  if (format === 'decimal') {
    return hoursNum.toFixed(2);
  } else {
    // Convert to HH:MM:SS
    const totalSeconds = Math.round(hoursNum * 3600);
    return formatSeconds(totalSeconds);
  }
}

/**
 * Convert time string (HH:MM:SS) to decimal hours
 * @param timeString - Time in HH:MM:SS format
 * @returns Decimal hours
 */
export function timeToDecimal(timeString: string): number {
  const parts = timeString.split(':').map(part => parseInt(part, 10));
  
  if (parts.length < 2 || parts.some(isNaN)) {
    return 0;
  }
  
  const hours = parts[0];
  const minutes = parts[1];
  const seconds = parts.length > 2 ? parts[2] : 0;
  
  return hours + minutes / 60 + seconds / 3600;
}

/**
 * Increase time by a percentage
 * @param time - Time in decimal hours
 * @param percentage - Percentage to increase (e.g., 10 for 10%)
 * @returns Adjusted time in decimal hours
 */
export function adjustTime(time: number, percentage: number): number {
  return time * (1 + percentage / 100);
}

/**
 * Round time to the specified precision
 * @param time - Time in decimal hours
 * @param roundingType - Type of rounding to apply
 * @returns Rounded time in decimal hours
 */
export function roundTime(time: number, roundingType: RoundingType): number {
  switch (roundingType) {
    case 'nearest_tenth':
      return Math.round(time * 10) / 10;
    case 'nearest_quarter':
      return Math.round(time * 4) / 4;
    case 'nearest_half':
      return Math.round(time * 2) / 2;
    case 'none':
    default:
      return time;
  }
}

/**
 * Calculate duration between two timestamps in decimal hours
 * @param startTime - Start timestamp in milliseconds
 * @param endTime - End timestamp in milliseconds
 * @returns Duration in decimal hours
 */
export function calculateDuration(startTime: number, endTime: number): number {
  const durationMs = endTime - startTime;
  return durationMs / (1000 * 60 * 60); // Convert to hours
}
