import { z } from 'zod';

// Order Form Validation Schema
export const orderFormSchema = z.object({
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9._-]+$/, 'Invalid symbol format'),
  
  side: z.enum(['BUY', 'SELL'], {
    required_error: 'Order side is required',
  }),
  
  type: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'], {
    required_error: 'Order type is required',
  }),
  
  quantity: z.number()
    .min(1, 'Quantity must be at least 1')
    .max(1000000, 'Quantity too large')
    .int('Quantity must be a whole number'),
  
  price: z.number()
    .min(0.01, 'Price must be greater than 0')
    .max(1000000, 'Price too high')
    .optional(),
  
  stopPrice: z.number()
    .min(0.01, 'Stop price must be greater than 0')
    .max(1000000, 'Stop price too high')
    .optional(),
  
  timeInForce: z.enum(['DAY', 'GTC', 'IOC', 'FOK'], {
    required_error: 'Time in force is required',
  }),
}).refine((data) => {
  // Require price for LIMIT and STOP_LIMIT orders
  if ((data.type === 'LIMIT' || data.type === 'STOP_LIMIT') && !data.price) {
    return false;
  }
  // Require stop price for STOP and STOP_LIMIT orders
  if ((data.type === 'STOP' || data.type === 'STOP_LIMIT') && !data.stopPrice) {
    return false;
  }
  return true;
}, {
  message: 'Price is required for LIMIT orders and Stop Price is required for STOP orders',
});

// Login Form Validation Schema
export const loginFormSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(100, 'Email too long'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
  
  rememberMe: z.boolean().default(false),
});

// Registration Form Validation Schema
export const registrationFormSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s]+$/, 'Invalid first name format'),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s]+$/, 'Invalid last name format'),
  
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(100, 'Email too long'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number and special character'),
  
  confirmPassword: z.string(),
  
  accountType: z.enum(['INDIVIDUAL', 'INSTITUTIONAL', 'PROFESSIONAL']),
  
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Price Alert Form Validation Schema
export const priceAlertSchema = z.object({
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9._-]+$/, 'Invalid symbol format'),
  
  condition: z.enum(['ABOVE', 'BELOW', 'CROSSES_ABOVE', 'CROSSES_BELOW']),
  
  price: z.number()
    .min(0.01, 'Price must be greater than 0')
    .max(1000000, 'Price too high'),
});

// Watchlist Item Validation Schema
export const watchlistItemSchema = z.object({
  symbol: z.string()
    .min(1, 'Symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9._-]+$/, 'Invalid symbol format'),
  
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
});

// Validation Helper Functions
export const validateSymbol = (symbol: string): boolean => {
  return /^[A-Z0-9._-]+$/.test(symbol) && symbol.length <= 10;
};

export const validateEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success;
};

export const validatePrice = (price: number): boolean => {
  return price > 0 && price <= 1000000 && !isNaN(price);
};

export const validateQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 1000000;
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Market Hours Validation
export const isMarketOpen = (date = new Date()): boolean => {
  const now = new Date(date);
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Market is closed on weekends
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Regular trading hours: 9:30 AM to 4:00 PM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM in minutes
  const marketClose = 16 * 60; // 4:00 PM in minutes
  
  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
};

export const isExtendedHours = (date = new Date()): boolean => {
  const now = new Date(date);
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Extended hours not available on weekends
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Pre-market: 4:00 AM to 9:30 AM ET
  const preMarketStart = 4 * 60; // 4:00 AM
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  
  // After-hours: 4:00 PM to 8:00 PM ET
  const marketClose = 16 * 60; // 4:00 PM
  const afterHoursEnd = 20 * 60; // 8:00 PM
  
  return (
    (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) ||
    (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd)
  );
};

// Risk Validation
export const validateRiskParameters = (
  orderValue: number,
  portfolioValue: number,
  maxPositionSize = 0.1 // 10% max position size
): {
  isValid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];
  
  const positionPercent = orderValue / portfolioValue;
  
  if (positionPercent > maxPositionSize) {
    warnings.push(`Order exceeds maximum position size of ${maxPositionSize * 100}%`);
  }
  
  if (positionPercent > 0.25) {
    warnings.push('Order is more than 25% of portfolio value');
  }
  
  if (orderValue > portfolioValue * 0.5) {
    warnings.push('Order exceeds 50% of portfolio value');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
  };
};

// Input Sanitization
export const sanitizeSymbol = (symbol: string): string => {
  return symbol.toUpperCase().trim().replace(/[^A-Z0-9._-]/g, '');
};

export const sanitizeNumericInput = (input: string): string => {
  return input.replace(/[^0-9.-]/g, '');
};

export const parseNumericInput = (input: string): number | null => {
  const sanitized = sanitizeNumericInput(input);
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? null : parsed;
};