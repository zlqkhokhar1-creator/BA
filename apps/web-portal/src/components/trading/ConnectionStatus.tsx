'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

export function ConnectionStatus() {
  const { isConnected, connectionStatus } = useWebSocket();
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setLastConnected(new Date());
    }
  }, [isConnected]);

  const getStatusIcon = () => {
    if (isConnected) {
      return <CheckCircle className="w-4 h-4 text-success-600" />;
    }
    
    if (connectionStatus.marketData === 'RECONNECTING' || 
        connectionStatus.trading === 'RECONNECTING' || 
        connectionStatus.portfolio === 'RECONNECTING') {
      return <Clock className="w-4 h-4 text-warning-600 animate-pulse" />;
    }
    
    return <WifiOff className="w-4 h-4 text-danger-600" />;
  };

  const getStatusText = () => {
    if (isConnected) {
      return 'Connected';
    }
    
    if (connectionStatus.marketData === 'RECONNECTING' || 
        connectionStatus.trading === 'RECONNECTING' || 
        connectionStatus.portfolio === 'RECONNECTING') {
      return 'Reconnecting...';
    }
    
    return 'Disconnected';
  };

  const getStatusColor = () => {
    if (isConnected) {
      return 'text-success-600 bg-success-100 dark:bg-success-900/20';
    }
    
    if (connectionStatus.marketData === 'RECONNECTING' || 
        connectionStatus.trading === 'RECONNECTING' || 
        connectionStatus.portfolio === 'RECONNECTING') {
      return 'text-warning-600 bg-warning-100 dark:bg-warning-900/20';
    }
    
    return 'text-danger-600 bg-danger-100 dark:bg-danger-900/20';
  };

  const getConnectionDetails = () => {
    return [
      {
        service: 'Market Data',
        status: connectionStatus.marketData,
        icon: <Activity className="w-3 h-3" />
      },
      {
        service: 'Trading',
        status: connectionStatus.trading,
        icon: <Wifi className="w-3 h-3" />
      },
      {
        service: 'Portfolio',
        status: connectionStatus.portfolio,
        icon: <Activity className="w-3 h-3" />
      }
    ];
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 ${getStatusColor()}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {getStatusText()}
        </span>
        <motion.div
          animate={{ rotate: showDetails ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <AlertCircle className="w-3 h-3" />
        </motion.div>
      </motion.button>

      {/* Connection Details Dropdown */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-dark-bg-secondary border border-neutral-200 dark:border-dark-border rounded-lg shadow-lg z-50"
          >
            <div className="p-4">
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-dark-text-primary mb-3">
                Connection Status
              </h4>
              
              <div className="space-y-3">
                {getConnectionDetails().map((detail, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {detail.icon}
                      <span className="text-sm text-neutral-700 dark:text-dark-text-secondary">
                        {detail.service}
                      </span>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      detail.status === 'CONNECTED' 
                        ? 'text-success-600 bg-success-100 dark:bg-success-900/20'
                        : detail.status === 'RECONNECTING'
                        ? 'text-warning-600 bg-warning-100 dark:bg-warning-900/20'
                        : 'text-danger-600 bg-danger-100 dark:bg-danger-900/20'
                    }`}>
                      {detail.status}
                    </div>
                  </div>
                ))}
              </div>

              {lastConnected && (
                <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    Last connected: {lastConnected.toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}