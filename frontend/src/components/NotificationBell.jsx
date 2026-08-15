import React from 'react';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  return (
    <div className="relative">
      <Bell />
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1">
        3
      </span>
    </div>
  );
}