'use client';

export function ConnectionStatus() {
  return (
    <div className="flex items-center gap-2 p-2">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
    </div>
  );
}