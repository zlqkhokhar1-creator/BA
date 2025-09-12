import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format currency values with proper precision
 */
export const formatCurrency = (
  value: number,
  currency = 'USD',
  minimumFractionDigits = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  }).format(value);
};

/**
 * Format percentage values
 */
export const formatPercent = (
  value: number,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value / 100);
};

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export const formatNumber = (value: number, precision = 1): string => {
  if (Math.abs(value) >= 1e9) {
    return (value / 1e9).toFixed(precision) + 'B';
  } else if (Math.abs(value) >= 1e6) {
    return (value / 1e6).toFixed(precision) + 'M';
  } else if (Math.abs(value) >= 1e3) {
    return (value / 1e3).toFixed(precision) + 'K';
  }
  return value.toLocaleString();
};

/**
 * Format price with appropriate decimal places based on value
 */
export const formatPrice = (price: number): string => {
  if (price >= 1000) {
    return price.toFixed(2);
  } else if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(4);
  } else {
    return price.toFixed(6);
  }
};

/**
 * Format volume with appropriate abbreviations
 */
export const formatVolume = (volume: number): string => {
  if (volume >= 1e9) {
    return (volume / 1e9).toFixed(1) + 'B';
  } else if (volume >= 1e6) {
    return (volume / 1e6).toFixed(1) + 'M';
  } else if (volume >= 1e3) {
    return (volume / 1e3).toFixed(1) + 'K';
  }
  return volume.toString();
};

/**
 * Format date/time for display
 */
export const formatDate = (
  date: Date | string,
  formatStr = 'MMM dd, yyyy'
): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
};

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
};

/**
 * Format time for trading display (HH:mm:ss)
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'HH:mm:ss');
};

/**
 * Format market session time
 */
export const formatSessionTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'HH:mm:ss.SSS');
};

/**
 * Format P&L with color coding
 */
export const formatPnL = (value: number, showSign = true): {
  formatted: string;
  color: 'success' | 'danger' | 'gray';
} => {
  const formatted = showSign 
    ? (value >= 0 ? '+' : '') + formatCurrency(value)
    : formatCurrency(Math.abs(value));
  
  const color = value > 0 ? 'success' : value < 0 ? 'danger' : 'gray';
  
  return { formatted, color };
};

/**
 * Format change percentage with color coding
 */
export const formatChange = (value: number, showSign = true): {
  formatted: string;
  color: 'success' | 'danger' | 'gray';
} => {
  const formatted = showSign 
    ? (value >= 0 ? '+' : '') + formatPercent(value)
    : formatPercent(Math.abs(value));
  
  const color = value > 0 ? 'success' : value < 0 ? 'danger' : 'gray';
  
  return { formatted, color };
};

/**
 * Format order status for display
 */
export const formatOrderStatus = (status: string): string => {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Format symbol for display (remove exchange suffix if present)
 */
export const formatSymbol = (symbol: string): string => {
  return symbol.split(':')[0]; // Remove exchange suffix like "AAPL:NASDAQ"
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Format latency in milliseconds
 */
export const formatLatency = (ms: number): string => {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
};

/**
 * Format market cap
 */
export const formatMarketCap = (marketCap: number): string => {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  } else {
    return formatCurrency(marketCap);
  }
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Format duration in seconds to human readable format
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};