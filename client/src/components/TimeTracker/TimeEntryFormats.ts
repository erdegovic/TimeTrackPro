/**
 * Utility functions for time entry formatting and conversion
 */

/**
 * Convert a duration in decimal hours to HH:MM:SS format
 */
export function formatDecimalToTime(decimalHours: number | string): string {
  try {
    const hours = typeof decimalHours === 'string' ? 
      parseFloat(decimalHours) : decimalHours;
    
    if (isNaN(hours)) return "00:00:00";
    
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    const seconds = Math.round(((hours - wholeHours) * 60 - minutes) * 60);
    
    // Handle edge case where seconds rounds to 60
    let adjustedMinutes = minutes;
    let adjustedSeconds = seconds;
    
    if (seconds === 60) {
      adjustedMinutes += 1;
      adjustedSeconds = 0;
    }
    
    if (adjustedMinutes === 60) {
      return `${(wholeHours + 1).toString().padStart(2, '0')}:00:00`;
    }
    
    return `${wholeHours.toString().padStart(2, '0')}:${adjustedMinutes.toString().padStart(2, '0')}:${adjustedSeconds.toString().padStart(2, '0')}`;
  } catch (e) {
    console.error("Error formatting decimal to time:", e);
    return "00:00:00";
  }
}

/**
 * Convert a time string (HH:MM:SS) to decimal hours
 */
export function parseTimeToDecimal(timeStr: string): number {
  try {
    if (!timeStr.includes(':')) {
      return parseFloat(timeStr) || 0;
    }
    
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = (parts.length > 1 && parts[1]) ? parseInt(parts[1]) / 60 : 0;
    const seconds = (parts.length > 2 && parts[2]) ? parseInt(parts[2]) / 3600 : 0;
    
    return parseFloat((hours + minutes + seconds).toFixed(2));
  } catch (e) {
    console.error("Error parsing time to decimal:", e);
    return 0;
  }
}

/**
 * Format display duration based on time format
 */
export function formatDurationDisplay(duration: string | number, timeFormat: 'decimal' | 'time'): string {
  try {
    if (typeof duration === 'string') {
      duration = parseFloat(duration) || 0;
    }
    
    if (timeFormat === 'decimal') {
      return `${duration.toFixed(2)}h`;
    } else {
      return formatDecimalToTime(duration);
    }
  } catch (e) {
    console.error("Error formatting duration display:", e);
    return timeFormat === 'decimal' ? "0.00h" : "00:00:00";
  }
}