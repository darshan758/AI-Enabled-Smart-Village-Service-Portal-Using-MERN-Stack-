import React from 'react';

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-5">
      <h2 className="text-xl font-bold mb-6">Smart Village</h2>

      <ul className="space-y-4">
        <li>Dashboard</li>
        <li>Complaints</li>
        <li>Profile</li>
      </ul>
    </div>
  );
}