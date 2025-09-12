'use client';

interface OrderBookProps {
  symbol: string;
}

export function OrderBook({ symbol }: OrderBookProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Order Book - {symbol}</h3>
      <p className="text-gray-500">Order book functionality coming soon...</p>
    </div>
  );
}