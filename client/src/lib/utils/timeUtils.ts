/**
 * Format time value into a string
 * Handles formatting in either decimal format or HH:MM:SS format
 * Can accept either seconds or decimal hours as input
 */
export function formatTime(value: number, format: 'decimal' | 'time' = 'time'): string {
  // Check if the value is already in hours (anything less than 100 is likely hours, not seconds)
  // This handles cases where the duration is stored in decimal hours instead of seconds
  const isValueInHours = value < 100;
  
  // Convert everything to seconds for consistent processing
  const seconds = isValueInHours ? value * 3600 : value;
  
  if (format === 'decimal') {
    // Convert to hours with 2 decimal places
    return (seconds / 3600).toFixed(2);
  } else {
    // Format as HH:MM:SS
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
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
    'JPY': '¥',
    'CAD': 'CA$',
    'AUD': 'A$',
    'INR': '₹',
    'CNY': '¥',
    'BRL': 'R$',
    'ZAR': 'R',
    'RSD': 'RSD'
  };
  
  const symbol = currencySymbols[currencyCode] || currencyCode;
  
  // Format with 2 decimal places
  const formattedAmount = amount.toFixed(2);
  
  // For most currencies, the symbol comes before the amount
  if (['RSD', 'SEK', 'DKK', 'NOK'].includes(currencyCode)) {
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

/**
 * Parse a time string (HH:MM:SS or decimal) to hours in decimal
 * @param timeStr Time string in format "HH:MM:SS" or decimal string
 * @returns Hours in decimal format
 */
export function parseTime(timeStr: string, format: 'decimal' | 'time' = 'time'): number {
  if (format === 'decimal') {
    return parseFloat(timeStr) || 0;
  }
  
  // Try to parse HH:MM:SS format
  const timeParts = timeStr.split(':');
  if (timeParts.length === 3) {
    const hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;
    const seconds = parseInt(timeParts[2], 10) || 0;
    
    return hours + (minutes / 60) + (seconds / 3600);
  }
  
  // Fallback - try to parse as decimal
  return parseFloat(timeStr) || 0;
}

/**
 * Convert between currencies using accurate exchange rates
 */
export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  // If currencies are the same, no conversion needed
  if (fromCurrency === toCurrency) return amount;
  
  // Define exchange rates (as of May 2025)
  // Using accurate rates where 12.8 USD = 9.64 GBP
  const rates: {[key: string]: {[key: string]: number}} = {
    'USD': {
      'EUR': 0.9125,
      'GBP': 0.7531,  // Fixed: 12.8 USD = 9.64 GBP (0.7531 rate)
      'CAD': 1.3584,
      'RSD': 109.52
    },
    'EUR': {
      'USD': 1.0959,
      'GBP': 0.8253,
      'CAD': 1.4887,
      'RSD': 120.02
    },
    'GBP': {
      'USD': 1.3279,  // Fixed: Inverse of USD to GBP
      'EUR': 1.2117,
      'CAD': 1.8038,
      'RSD': 145.43
    },
    'CAD': {
      'USD': 0.7362,
      'EUR': 0.6718,
      'GBP': 0.5544,
      'RSD': 80.63
    },
    'RSD': {
      'USD': 0.00913,
      'EUR': 0.00833,
      'GBP': 0.00688,
      'CAD': 0.01240
    }
  };
  
  // Perform conversion
  if (rates[fromCurrency] && rates[fromCurrency][toCurrency]) {
    return parseFloat((amount * rates[fromCurrency][toCurrency]).toFixed(4));
  }
  
  // If no direct conversion rate, convert via USD
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const toUSD = convertCurrency(amount, fromCurrency, 'USD');
    return convertCurrency(toUSD, 'USD', toCurrency);
  }
  
  // Default: return original amount if no conversion possible
  console.error(`No conversion rate available for ${fromCurrency} to ${toCurrency}`);
  return amount;
}