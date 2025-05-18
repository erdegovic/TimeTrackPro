export function formatTime(seconds: number, format: 'decimal' | 'time' = 'time'): string {
  if (format === 'decimal') {
    // Format as decimal (e.g., 1.5h)
    const hours = seconds / 3600;
    return `${hours.toFixed(2)}h`;
  } else {
    // Format as time (e.g., 01:30:45)
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    return [h, m, s]
      .map(v => v.toString().padStart(2, '0'))
      .join(':');
  }
}

export function calculateDuration(startTime: number, endTime: number): string {
  // Calculate duration in seconds
  const durationInSeconds = Math.floor((endTime - startTime) / 1000);
  return formatTime(durationInSeconds);
}

// Time adjustment functions
export function adjustTime(seconds: number, percentage: number = 0): number {
  if (percentage === 0) return seconds;
  
  // Apply percentage increase
  const factor = 1 + percentage / 100;
  return seconds * factor;
}

export function roundTime(
  seconds: number, 
  roundingType: 'none' | 'nearest_tenth' | 'nearest_quarter' | 'nearest_half' = 'none'
): number {
  if (roundingType === 'none') return seconds;
  
  // Convert to hours
  let hoursFraction = seconds / 3600;
  
  // Apply rounding based on type
  switch(roundingType) {
    case 'nearest_tenth':
      hoursFraction = Math.round(hoursFraction * 10) / 10;
      break;
    case 'nearest_quarter':
      hoursFraction = Math.round(hoursFraction * 4) / 4;
      break;
    case 'nearest_half':
      hoursFraction = Math.round(hoursFraction * 2) / 2;
      break;
  }
  
  // Convert back to seconds
  const rounded = hoursFraction * 3600;
  return Math.max(0, rounded);
}