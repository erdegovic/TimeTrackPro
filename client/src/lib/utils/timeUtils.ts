import { TimeFormat } from "@shared/schema";
import { format } from "date-fns";

/**
 * Formats a time in decimal hours to either decimal or HH:MM:SS format
 * @param hours Time in decimal hours
 * @param format The format to display (decimal or time)
 * @returns A formatted string representation of the time
 */
export function formatTime(hours: number, format: TimeFormat = "decimal"): string {
  if (isNaN(hours)) {
    console.error("Invalid hours value:", hours);
    return "0";
  }
  
  if (format === "decimal") {
    // Format as decimal with 2 decimal places
    return Number(hours).toFixed(2);
  } else {
    // Format as HH:MM:SS
    const totalMinutes = Math.floor(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    const s = Math.floor((hours * 3600) % 60);
    
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

/**
 * Converts a time string in the format HH:MM:SS to decimal hours
 * @param timeString A string in HH:MM:SS format
 * @returns Decimal hours
 */
export function timeStringToDecimal(timeString: string): number {
  // Handle empty string
  if (!timeString || timeString.trim() === '') {
    return 0;
  }
  
  try {
    // Split the time string by ":"
    const parts = timeString.split(':');
    
    if (parts.length === 3) {
      // Format is HH:MM:SS
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10) / 60;
      const seconds = parseInt(parts[2], 10) / 3600;
      
      return hours + minutes + seconds;
    } else if (parts.length === 2) {
      // Format is HH:MM
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10) / 60;
      
      return hours + minutes;
    } else {
      // Assume it's just hours
      return parseFloat(timeString);
    }
  } catch (error) {
    console.error("Error parsing time string:", error);
    return 0;
  }
}

/**
 * Formats a currency value according to a currency code
 * @param amount The monetary amount
 * @param currencyCode The ISO currency code (e.g., USD, EUR)
 * @returns A formatted currency string
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  if (isNaN(amount)) {
    console.error("Invalid amount value:", amount);
    return "0.00";
  }
  
  // Use Intl.NumberFormat for proper currency formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Rounds a decimal hours value according to the specified rounding type
 * @param hours Decimal hours to round
 * @param roundingType Type of rounding to apply
 * @returns Rounded decimal hours
 */
export function roundTime(hours: number, roundingType: string): number {
  if (isNaN(hours)) {
    console.error("Invalid hours value for rounding:", hours);
    return 0;
  }
  
  switch (roundingType) {
    case 'nearest_tenth':
      return Math.round(hours * 10) / 10;
    case 'nearest_quarter':
      return Math.round(hours * 4) / 4;
    case 'nearest_half':
      return Math.round(hours * 2) / 2;
    case 'none':
    default:
      return hours;
  }
}

/**
 * Adjusts time by a percentage (increase or decrease)
 * @param hours Original hours
 * @param percentage Percentage to adjust by
 * @param increaseByPercentage Whether to increase (true) or decrease (false)
 * @returns Adjusted time
 */
export function adjustTime(
  hours: number,
  percentage: number,
  increaseByPercentage: boolean = true
): number {
  if (isNaN(hours)) {
    console.error("Invalid hours value for adjustment:", hours);
    return 0;
  }
  
  if (isNaN(percentage) || percentage < 0) {
    console.error("Invalid percentage value:", percentage);
    return hours;
  }
  
  const factor = percentage / 100;
  
  return increaseByPercentage
    ? hours * (1 + factor)  // Increase
    : hours * (1 - factor); // Decrease
}

/**
 * Converts an amount from one currency to another using a conversion rate
 * @param amount Amount to convert
 * @param fromCurrency Source currency code
 * @param toCurrency Target currency code
 * @param conversionRates Optional conversion rate map
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  conversionRates?: Record<string, Record<string, number>>
): number {
  // If currencies are the same, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // Default conversion rates (very simplified)
  // In a real app, these would come from an API
  const defaultRates: Record<string, Record<string, number>> = {
    'USD': {
      'EUR': 0.92,
      'GBP': 0.78,
      'CAD': 1.36,
      'AUD': 1.51,
      'JPY': 150.29,
      'CNY': 7.25,
      'RSD': 108.55
    },
    'EUR': {
      'USD': 1.09,
      'GBP': 0.85,
      'CAD': 1.48,
      'AUD': 1.64,
      'JPY': 163.61,
      'CNY': 7.88,
      'RSD': 117.34
    },
    'GBP': {
      'USD': 1.28,
      'EUR': 1.18,
      'CAD': 1.74,
      'AUD': 1.94,
      'JPY': 193.43,
      'CNY': 9.31,
      'RSD': 139.18
    },
    'RSD': {
      'USD': 0.0092,
      'EUR': 0.0085,
      'GBP': 0.0072,
      'CAD': 0.0126,
      'AUD': 0.0139,
      'JPY': 1.39
    }
  };
  
  // Use provided rates or default to our simplified set
  const rates = conversionRates || defaultRates;
  
  // Get the conversion rate
  if (rates[fromCurrency] && rates[fromCurrency][toCurrency]) {
    return amount * rates[fromCurrency][toCurrency];
  }
  
  // If direct conversion not available, try via USD as a bridge
  if (fromCurrency !== 'USD' && rates[fromCurrency] && rates[fromCurrency]['USD'] &&
      rates['USD'] && rates['USD'][toCurrency]) {
    const usdAmount = amount * rates[fromCurrency]['USD'];
    return usdAmount * rates['USD'][toCurrency];
  }
  
  // If no conversion rate available, return original amount
  console.warn(`No conversion rate available from ${fromCurrency} to ${toCurrency}`);
  return amount;
}

/**
 * Formats a date string to a user-friendly format
 * @param dateString ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
}