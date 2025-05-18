/**
 * Format seconds into a time string
 * Handles formatting in either decimal format or HH:MM:SS format
 */
export function formatTime(seconds: number, format: 'decimal' | 'time' = 'time'): string {
  if (format === 'decimal') {
    // Convert to hours with 2 decimal places
    return (seconds / 3600).toFixed(2);
  } else {
    // Format as HH:MM:SS
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Convert a decimal hours value to a time string (HH:MM:SS)
 */
export function formatTimeFromDecimal(decimalHours: number): string {
  // Convert to seconds first
  const totalSeconds = Math.round(decimalHours * 3600);
  return formatTime(totalSeconds);
}

/**
 * Calculate duration between two timestamps in hours (decimal)
 */
export function calculateDuration(startTime: number, endTime: number): number {
  const diffMs = endTime - startTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  return parseFloat(diffHours.toFixed(4)); // Keep 4 decimal places for precision
}

/**
 * Format currency value based on the provided currency code
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const currencySymbols: {[key: string]: string} = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'CAD': 'CA$',
    'RSD': 'RSD'
  };
  
  const symbol = currencySymbols[currencyCode] || currencyCode;
  
  // Format with 2 decimal places
  const formattedAmount = amount.toFixed(2);
  
  // For most currencies, the symbol comes before the amount
  if (currencyCode === 'RSD') {
    return `${formattedAmount} ${symbol}`;
  } else {
    return `${symbol}${formattedAmount}`;
  }
}

/**
 * Get client currency from a client ID using cached client data
 */
export function getClientCurrency(clientId: number): string {
  try {
    const cachedClients = localStorage.getItem("cachedClients");
    if (cachedClients) {
      const clients = JSON.parse(cachedClients);
      const client = clients.find((c: any) => c.id === clientId);
      return client?.currency || 'USD';
    }
  } catch (error) {
    console.error("Error getting client currency:", error);
  }
  return 'USD'; // Default to USD if client not found
}

/**
 * Adjust time by a percentage increase
 * @param duration Duration in hours (decimal)
 * @param percentage Percentage to increase by
 * @returns Adjusted duration in hours
 */
export function adjustTime(duration: number, percentage: number): number {
  return duration * (1 + percentage / 100);
}

/**
 * Round time according to the specified rounding type
 * @param duration Duration in hours (decimal)
 * @param roundingType Type of rounding to apply
 * @returns Rounded duration in hours
 */
export function roundTime(
  duration: number, 
  roundingType: 'none' | 'nearest_tenth' | 'nearest_quarter' | 'nearest_half'
): number {
  switch (roundingType) {
    case 'nearest_tenth':
      return Math.round(duration * 10) / 10;
    case 'nearest_quarter':
      return Math.round(duration * 4) / 4;
    case 'nearest_half':
      return Math.round(duration * 2) / 2;
    case 'none':
    default:
      return duration;
  }
}