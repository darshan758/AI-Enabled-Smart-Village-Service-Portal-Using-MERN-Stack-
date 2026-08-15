import React from 'react';

export default function StatsCard({ label, value, icon: Icon, color = 'primary', trend }) {
  const colorMap = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400',
    yellow:  'bg-yellow-50  dark:bg-yellow-900/20  text-yellow-700  dark:text-yellow-400',
    blue:    'bg-blue-50    dark:bg-blue-900/20    text-blue-700    dark:text-blue-400',
    green:   'bg-green-50   dark:bg-green-900/20   text-green-700   dark:text-green-400',
    red:     'bg-red-50     dark:bg-red-900/20     text-red-700     dark:text-red-400',
    purple:  'bg-purple-50  dark:bg-purple-900/20  text-purple-700  dark:text-purple-400',
  };

  return (
    <div className="card p-5 flex items-center gap-4 animate-fade-in">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {trend !== undefined && (
          <p className={`text-xs font-medium mt-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} this month
          </p>
        )}
      </div>
    </div>
  );
}
