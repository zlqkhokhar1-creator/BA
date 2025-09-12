'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Clock,
  DollarSign
} from 'lucide-react';
import { orderFormSchema } from '@/utils/validators';
import { formatCurrency, formatPrice } from '@/utils/formatters';
import { OrderFormData } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';

interface OrderFormProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  className?: string;
}

export function OrderForm({ symbol, onSymbolChange, className = '' }: OrderFormProps) {
  const { emit, isConnected } = useWebSocket();
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [quickOrderMode, setQuickOrderMode] = useState<'BUY' | 'SELL' | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
    trigger
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
      timeInForce: 'DAY',
    },
  });

  const watchedValues = watch();

  // Update symbol when prop changes
  useEffect(() => {
    setValue('symbol', symbol);
  }, [symbol, setValue]);

  // Calculate estimated cost
  useEffect(() => {
    const { quantity, price, type } = watchedValues;
    if (quantity && (type === 'MARKET' ? currentPrice : price)) {
      const orderPrice = type === 'MARKET' ? currentPrice : price;
      if (orderPrice) {
        setEstimatedCost(quantity * orderPrice);
      }
    } else {
      setEstimatedCost(null);
    }
  }, [watchedValues, currentPrice]);

  // Mock current price (in real implementation, this would come from market data)
  useEffect(() => {
    const priceInterval = setInterval(() => {
      setCurrentPrice(prev => {
        const basePrice = 150; // Mock price for AAPL
        const variation = (Math.random() - 0.5) * 2;
        return Math.max(0.01, (prev || basePrice) + variation);
      });
    }, 1000);

    return () => clearInterval(priceInterval);
  }, [symbol]);

  const onSubmit = async (data: OrderFormData) => {
    if (!isConnected) {
      setOrderError('Not connected to trading server');
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      // Emit order through WebSocket for real-time processing
      emit('place_order', {
        ...data,
        timestamp: new Date().toISOString(),
      });

      // Simulate order processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Reset form on successful submission
      reset({
        symbol: data.symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
        timeInForce: 'DAY',
      });
      
      setOrderSuccess(`Order placed successfully: ${data.side} ${data.quantity} ${data.symbol}`);
      setQuickOrderMode(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setOrderSuccess(null), 3000);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickOrder = (side: 'BUY' | 'SELL') => {
    setQuickOrderMode(side);
    setValue('side', side);
    setValue('type', 'MARKET');
    setValue('quantity', 1);
    handleSubmit(onSubmit)();
  };

  const getOrderTypeDescription = (type: string) => {
    const descriptions = {
      'MARKET': 'Execute immediately at current market price',
      'LIMIT': 'Execute only at specified price or better',
      'STOP': 'Execute when price reaches stop price',
      'STOP_LIMIT': 'Execute as limit order when stop price is reached'
    };
    return descriptions[type as keyof typeof descriptions] || '';
  };

  const getTimeInForceDescription = (tif: string) => {
    const descriptions = {
      'DAY': 'Valid for the current trading day',
      'GTC': 'Good until cancelled',
      'IOC': 'Immediate or cancel',
      'FOK': 'Fill or kill'
    };
    return descriptions[tif as keyof typeof descriptions] || '';
  };

  return (
    <div className={`trading-panel ${className}`}>
      <div className="trading-panel-header">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
            Place Order
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>

      <div className="trading-panel-content">
        {/* Quick Order Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <motion.button
            type="button"
            onClick={() => handleQuickOrder('BUY')}
            disabled={isSubmitting || !isConnected}
            className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              quickOrderMode === 'BUY'
                ? 'bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-400 border-2 border-success-300 dark:border-success-700'
                : 'bg-success-600 hover:bg-success-700 text-white border-2 border-success-600 hover:border-success-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Quick Buy</span>
            <Zap className="w-4 h-4" />
          </motion.button>
          
          <motion.button
            type="button"
            onClick={() => handleQuickOrder('SELL')}
            disabled={isSubmitting || !isConnected}
            className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              quickOrderMode === 'SELL'
                ? 'bg-danger-100 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 border-2 border-danger-300 dark:border-danger-700'
                : 'bg-danger-600 hover:bg-danger-700 text-white border-2 border-danger-600 hover:border-danger-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <TrendingDown className="w-5 h-5" />
            <span>Quick Sell</span>
            <Zap className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Symbol Input */}
          <div>
            <label className="form-label">Symbol</label>
            <input
              {...register('symbol')}
              type="text"
              placeholder="Enter symbol (e.g., AAPL)"
              className="form-input uppercase text-lg font-semibold"
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setValue('symbol', value);
                onSymbolChange(value);
              }}
            />
            {errors.symbol && (
              <p className="mt-1 text-sm text-danger-600">{errors.symbol.message}</p>
            )}
          </div>

          {/* Current Price Display */}
          {currentPrice && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-neutral-50 dark:bg-dark-bg-tertiary rounded-lg border border-neutral-200 dark:border-dark-border"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-dark-text-secondary">
                    Current Price:
                  </span>
                </div>
                <span className="text-xl font-bold text-neutral-900 dark:text-dark-text-primary">
                  {formatPrice(currentPrice)}
                </span>
              </div>
            </motion.div>
          )}

          {/* Side and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Side</label>
              <select {...register('side')} className="form-select">
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>

            <div>
              <label className="form-label">Type</label>
              <select {...register('type')} className="form-select">
                <option value="MARKET">Market</option>
                <option value="LIMIT">Limit</option>
                <option value="STOP">Stop</option>
                <option value="STOP_LIMIT">Stop Limit</option>
              </select>
            </div>
          </div>

          {/* Order Type Description */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>{watchedValues.type}:</strong> {getOrderTypeDescription(watchedValues.type)}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="form-label">Quantity</label>
            <input
              {...register('quantity', { valueAsNumber: true })}
              type="number"
              min="1"
              step="1"
              placeholder="Enter quantity"
              className="form-input text-lg"
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-danger-600">{errors.quantity.message}</p>
            )}
          </div>

          {/* Price (for LIMIT and STOP_LIMIT orders) */}
          {(watchedValues.type === 'LIMIT' || watchedValues.type === 'STOP_LIMIT') && (
            <div>
              <label className="form-label">Price</label>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter price"
                className="form-input"
              />
              {errors.price && (
                <p className="mt-1 text-sm text-danger-600">{errors.price.message}</p>
              )}
            </div>
          )}

          {/* Stop Price (for STOP and STOP_LIMIT orders) */}
          {(watchedValues.type === 'STOP' || watchedValues.type === 'STOP_LIMIT') && (
            <div>
              <label className="form-label">Stop Price</label>
              <input
                {...register('stopPrice', { valueAsNumber: true })}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter stop price"
                className="form-input"
              />
              {errors.stopPrice && (
                <p className="mt-1 text-sm text-danger-600">{errors.stopPrice.message}</p>
              )}
            </div>
          )}

          {/* Time in Force */}
          <div>
            <label className="form-label">Time in Force</label>
            <select {...register('timeInForce')} className="form-select">
              <option value="DAY">Day</option>
              <option value="GTC">Good Till Canceled</option>
              <option value="IOC">Immediate or Cancel</option>
              <option value="FOK">Fill or Kill</option>
            </select>
            <p className="mt-1 text-xs text-neutral-500 dark:text-dark-text-tertiary">
              {getTimeInForceDescription(watchedValues.timeInForce)}
            </p>
          </div>

          {/* Estimated Cost */}
          {estimatedCost && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calculator className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                    Estimated {watchedValues.side === 'BUY' ? 'Cost' : 'Proceeds'}:
                  </span>
                </div>
                <span className="text-lg font-bold text-primary-900 dark:text-primary-100">
                  {formatCurrency(estimatedCost)}
                </span>
              </div>
            </motion.div>
          )}

          {/* Order Validation Warnings */}
          {watchedValues.quantity && watchedValues.quantity > 1000 && (
            <div className="p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-warning-600 dark:text-warning-400" />
                <span className="text-sm text-warning-700 dark:text-warning-300">
                  Large order size - consider breaking into smaller orders
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={isSubmitting || !isConnected}
            className={`w-full flex items-center justify-center space-x-2 py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
              watchedValues.side === 'BUY'
                ? 'bg-success-600 hover:bg-success-700 text-white'
                : 'bg-danger-600 hover:bg-danger-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner w-5 h-5"></div>
                <span>Placing Order...</span>
              </>
            ) : (
              <>
                {watchedValues.side === 'BUY' ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span>
                  {watchedValues.side} {watchedValues.quantity || 0} {watchedValues.symbol}
                </span>
              </>
            )}
          </motion.button>
        </form>

        {/* Order Status Messages */}
        <AnimatePresence>
          {orderSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-success-600" />
                <span className="text-sm text-success-700 dark:text-success-300">
                  {orderSuccess}
                </span>
              </div>
            </motion.div>
          )}

          {orderError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800"
            >
              <div className="flex items-center space-x-2">
                <XCircle className="w-4 h-4 text-danger-600" />
                <span className="text-sm text-danger-700 dark:text-danger-300">
                  {orderError}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}