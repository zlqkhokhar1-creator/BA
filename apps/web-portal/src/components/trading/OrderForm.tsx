'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
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
    // Simulate real-time price updates
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
      alert('Not connected to trading server');
      return;
    }

    setIsSubmitting(true);
    try {
      // Emit order through WebSocket for real-time processing
      emit('place_order', {
        ...data,
        timestamp: new Date().toISOString(),
      });

      // Also send to REST API for persistence
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Reset form on successful submission
        reset({
          symbol: data.symbol,
          side: 'BUY',
          type: 'MARKET',
          quantity: 1,
          timeInForce: 'DAY',
        });
        
        // Show success notification
        console.log('Order placed successfully');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      alert(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickOrder = (side: 'BUY' | 'SELL') => {
    setValue('side', side);
    setValue('type', 'MARKET');
    handleSubmit(onSubmit)();
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Place Order
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {isConnected ? (
            <span className="text-success-600">●</span>
          ) : (
            <span className="text-danger-600">●</span>
          )}
          {isConnected ? ' Connected' : ' Disconnected'}
        </div>
      </div>

      <div className="card-body">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Symbol Input */}
          <div className="form-group">
            <label className="form-label">Symbol</label>
            <input
              {...register('symbol')}
              type="text"
              placeholder="Enter symbol (e.g., AAPL)"
              className="form-input uppercase"
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setValue('symbol', value);
                onSymbolChange(value);
              }}
            />
            {errors.symbol && (
              <p className="form-error">{errors.symbol.message}</p>
            )}
          </div>

          {/* Current Price Display */}
          {currentPrice && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Current Price:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatPrice(currentPrice)}
                </span>
              </div>
            </div>
          )}

          {/* Side and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Side</label>
              <select {...register('side')} className="form-select">
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select {...register('type')} className="form-select">
                <option value="MARKET">Market</option>
                <option value="LIMIT">Limit</option>
                <option value="STOP">Stop</option>
                <option value="STOP_LIMIT">Stop Limit</option>
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input
              {...register('quantity', { valueAsNumber: true })}
              type="number"
              min="1"
              step="1"
              placeholder="Enter quantity"
              className="form-input"
            />
            {errors.quantity && (
              <p className="form-error">{errors.quantity.message}</p>
            )}
          </div>

          {/* Price (for LIMIT and STOP_LIMIT orders) */}
          {(watchedValues.type === 'LIMIT' || watchedValues.type === 'STOP_LIMIT') && (
            <div className="form-group">
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
                <p className="form-error">{errors.price.message}</p>
              )}
            </div>
          )}

          {/* Stop Price (for STOP and STOP_LIMIT orders) */}
          {(watchedValues.type === 'STOP' || watchedValues.type === 'STOP_LIMIT') && (
            <div className="form-group">
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
                <p className="form-error">{errors.stopPrice.message}</p>
              )}
            </div>
          )}

          {/* Time in Force */}
          <div className="form-group">
            <label className="form-label">Time in Force</label>
            <select {...register('timeInForce')} className="form-select">
              <option value="DAY">Day</option>
              <option value="GTC">Good Till Canceled</option>
              <option value="IOC">Immediate or Cancel</option>
              <option value="FOK">Fill or Kill</option>
            </select>
          </div>

          {/* Estimated Cost */}
          {estimatedCost && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Estimated {watchedValues.side === 'BUY' ? 'Cost' : 'Proceeds'}:
                </span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {formatCurrency(estimatedCost)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={isSubmitting || !isConnected}
            className={`w-full btn ${
              watchedValues.side === 'BUY'
                ? 'btn-success'
                : 'btn-danger'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="loading-spinner w-4 h-4 mr-2"></div>
                Placing Order...
              </div>
            ) : (
              `${watchedValues.side} ${watchedValues.quantity || 0} ${watchedValues.symbol}`
            )}
          </motion.button>

          {/* Quick Order Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <motion.button
              type="button"
              onClick={() => handleQuickOrder('BUY')}
              disabled={isSubmitting || !isConnected}
              className="btn btn-success btn-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Quick Buy
            </motion.button>
            <motion.button
              type="button"
              onClick={() => handleQuickOrder('SELL')}
              disabled={isSubmitting || !isConnected}
              className="btn btn-danger btn-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Quick Sell
            </motion.button>
          </div>
        </form>

        {/* Order Validation Warnings */}
        {watchedValues.quantity && watchedValues.quantity > 1000 && (
          <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-warning-600 dark:text-warning-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-warning-700 dark:text-warning-300">
                Large order size - consider breaking into smaller orders
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}