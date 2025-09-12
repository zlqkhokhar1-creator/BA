'use client';

import { Dispatch, SetStateAction } from 'react';

interface MarketDataProps {
  symbols: string[];
  selectedSymbol: string;
  onSymbolSelect: Dispatch<SetStateAction<string>>;
}

export function MarketData({ symbols, selectedSymbol, onSymbolSelect }: MarketDataProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Market Data</h3>
      <div className="space-y-2">
        {symbols.map((symbol) => (
          <div
            key={symbol}
            onClick={() => onSymbolSelect(symbol)}
            className={`p-2 cursor-pointer rounded ${
              selectedSymbol === symbol
                ? 'bg-blue-100 dark:bg-blue-900'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {symbol}
          </div>
        ))}
      </div>
    </div>
  );
}