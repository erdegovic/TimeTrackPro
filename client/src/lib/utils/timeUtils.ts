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
  hours: number, 
  roundingType: 'none' | 'nearest_tenth' | 'nearest_quarter' | 'nearest_half' = 'none'
): number {
  if (roundingType === 'none') return hours;
  
  // Apply rounding based on type
  // The input is already in hours (from duration field), so no need to convert
  let hoursFraction = hours;
  
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
  
  return Math.max(0, hoursFraction);
}

// Format amount based on currency
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const currencySymbols: {[key: string]: string} = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'C$',
    'RSD': 'RSD',
  };
  
  const symbol = currencySymbols[currency] || currency;
  
  // Use currency symbol before amount for USD, CAD, GBP
  if (['USD', 'CAD', 'GBP'].includes(currency)) {
    return `${symbol}${amount.toFixed(2)}`;
  }
  
  // Use currency symbol/code after amount for EUR, RSD
  return `${amount.toFixed(2)} ${symbol}`;
}