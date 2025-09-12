'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Settings
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'ORDER_FILLED' | 'PRICE_ALERT' | 'MARGIN_CALL' | 'SYSTEM' | 'SECURITY';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  read: boolean;
  timestamp: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Generate mock notifications
    const generateNotifications = (): Notification[] => {
      const types: Notification['type'][] = ['ORDER_FILLED', 'PRICE_ALERT', 'MARGIN_CALL', 'SYSTEM', 'SECURITY'];
      const priorities: Notification['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'ORDER_FILLED',
          title: 'Order Filled',
          message: 'Your BUY order for 100 AAPL shares has been filled at $152.80',
          priority: 'MEDIUM',
          read: false,
          timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          action: {
            label: 'View Order',
            onClick: () => console.log('View order')
          }
        },
        {
          id: '2',
          type: 'PRICE_ALERT',
          title: 'Price Alert Triggered',
          message: 'TSLA has reached your target price of $250.00',
          priority: 'HIGH',
          read: false,
          timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        },
        {
          id: '3',
          type: 'SYSTEM',
          title: 'System Maintenance',
          message: 'Scheduled maintenance will occur tonight from 2:00 AM to 4:00 AM EST',
          priority: 'LOW',
          read: true,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
          id: '4',
          type: 'MARGIN_CALL',
          title: 'Margin Call Warning',
          message: 'Your account is approaching margin call threshold. Please add funds or reduce positions.',
          priority: 'CRITICAL',
          read: false,
          timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          action: {
            label: 'Add Funds',
            onClick: () => console.log('Add funds')
          }
        }
      ];

      return mockNotifications;
    };

    const initialNotifications = generateNotifications();
    setNotifications(initialNotifications);

    // Add new notifications periodically
    const interval = setInterval(() => {
      if (Math.random() > 0.8) { // 20% chance of new notification
        const newNotification: Notification = {
          id: `notification-${Date.now()}`,
          type: 'ORDER_FILLED',
          title: 'Order Filled',
          message: `Your ${Math.random() > 0.5 ? 'BUY' : 'SELL'} order for ${Math.floor(Math.random() * 100) + 1} ${['AAPL', 'GOOGL', 'MSFT', 'TSLA'][Math.floor(Math.random() * 4)]} shares has been filled`,
          priority: 'MEDIUM',
          read: false,
          timestamp: new Date()
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 20)); // Keep only last 20
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'ORDER_FILLED':
        return <CheckCircle className="w-4 h-4 text-success-600" />;
      case 'PRICE_ALERT':
        return <TrendingUp className="w-4 h-4 text-warning-600" />;
      case 'MARGIN_CALL':
        return <AlertTriangle className="w-4 h-4 text-danger-600" />;
      case 'SYSTEM':
        return <Settings className="w-4 h-4 text-neutral-600" />;
      case 'SECURITY':
        return <AlertCircle className="w-4 h-4 text-danger-600" />;
      default:
        return <Info className="w-4 h-4 text-neutral-600" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'CRITICAL':
        return 'border-l-danger-500 bg-danger-50 dark:bg-danger-900/20';
      case 'HIGH':
        return 'border-l-warning-500 bg-warning-50 dark:bg-warning-900/20';
      case 'MEDIUM':
        return 'border-l-primary-500 bg-primary-50 dark:bg-primary-900/20';
      case 'LOW':
        return 'border-l-neutral-500 bg-neutral-50 dark:bg-neutral-900/20';
      default:
        return 'border-l-neutral-500 bg-neutral-50 dark:bg-neutral-900/20';
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Bell className="w-5 h-5 text-neutral-600 dark:text-dark-text-secondary" />
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </motion.button>

        {/* Notifications Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-dark-bg-secondary border border-neutral-200 dark:border-dark-border rounded-lg shadow-lg z-50"
            >
              <div className="p-4 border-b border-neutral-200 dark:border-dark-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text-primary">
                    Notifications
                  </h3>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 dark:text-dark-text-tertiary">
                      No notifications
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${
                          !notification.read ? 'bg-white dark:bg-dark-bg-secondary' : 'bg-neutral-50 dark:bg-dark-bg-tertiary'
                        } hover:bg-neutral-100 dark:hover:bg-dark-bg-tertiary transition-colors`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium ${
                                !notification.read 
                                  ? 'text-neutral-900 dark:text-dark-text-primary' 
                                  : 'text-neutral-700 dark:text-dark-text-secondary'
                              }`}>
                                {notification.title}
                              </p>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                                  {formatTime(notification.timestamp)}
                                </span>
                                <button
                                  onClick={() => removeNotification(notification.id)}
                                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-dark-bg-tertiary"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mt-1">
                              {notification.message}
                            </p>
                            {notification.action && (
                              <button
                                onClick={() => {
                                  notification.action?.onClick();
                                  markAsRead(notification.id);
                                }}
                                className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                              >
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {notifications
            .filter(n => !n.read && n.priority === 'CRITICAL')
            .slice(0, 3)
            .map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 300, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 300, scale: 0.8 }}
                className="bg-white dark:bg-dark-bg-secondary border border-danger-200 dark:border-danger-800 rounded-lg shadow-lg p-4 max-w-sm"
              >
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-danger-900 dark:text-danger-100">
                      {notification.title}
                    </p>
                    <p className="text-sm text-danger-700 dark:text-danger-300 mt-1">
                      {notification.message}
                    </p>
                    <div className="flex items-center space-x-2 mt-3">
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs bg-danger-600 text-white px-3 py-1 rounded hover:bg-danger-700 transition-colors"
                      >
                        Dismiss
                      </button>
                      {notification.action && (
                        <button
                          onClick={() => {
                            notification.action?.onClick();
                            markAsRead(notification.id);
                          }}
                          className="text-xs text-danger-600 hover:text-danger-700 font-medium"
                        >
                          {notification.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </>
  );
}