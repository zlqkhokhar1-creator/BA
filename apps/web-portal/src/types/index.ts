// Core Trading Types
export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  createdAt: Date;
  updatedAt: Date;
  filledQuantity: number;
  averagePrice?: number;
}

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
  lastUpdated: Date;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  commission: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  timestamp: Date;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  count: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: Date;
}

export interface Portfolio {
  id: string;
  userId: string;
  totalValue: number;
  cashBalance: number;
  dayChange: number;
  dayChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  positions: Position[];
  lastUpdated: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: 'INDIVIDUAL' | 'INSTITUTIONAL' | 'PROFESSIONAL';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'ORDER_FILLED' | 'PRICE_ALERT' | 'MARGIN_CALL' | 'SYSTEM' | 'SECURITY';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  read: boolean;
  createdAt: Date;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export interface MarketDataUpdate extends WebSocketMessage {
  type: 'MARKET_DATA';
  data: MarketData;
}

export interface OrderUpdate extends WebSocketMessage {
  type: 'ORDER_UPDATE';
  data: Order;
}

export interface PortfolioUpdate extends WebSocketMessage {
  type: 'PORTFOLIO_UPDATE';
  data: Portfolio;
}

// Performance Types
export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradeReturn: number;
  volatility: number;
}

export interface RiskMetrics {
  portfolioValue: number;
  cashBalance: number;
  marginUsed: number;
  marginAvailable: number;
  dayTradingBuyingPower: number;
  overnightBuyingPower: number;
  portfolioBeta: number;
  concentrationRisk: number;
  valueAtRisk: number;
}

// Chart Types
export interface ChartDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartConfig {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
  indicators: string[];
  overlays: string[];
}

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Form Types
export interface OrderFormData {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  addedAt: Date;
  alerts?: PriceAlert[];
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'ABOVE' | 'BELOW' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';
  price: number;
  isActive: boolean;
  createdAt: Date;
}

// Connection Status
export interface ConnectionStatus {
  marketData: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  trading: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  portfolio: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  lastUpdate: Date;
}

// Theme Types
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    danger: string;
    warning: string;
    background: string;
    surface: string;
    text: string;
  };
  darkMode: boolean;
}