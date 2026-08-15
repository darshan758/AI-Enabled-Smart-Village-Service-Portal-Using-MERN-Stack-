export const CATEGORIES = [
  'Street Light Damage',
  'Road Damage',
  'Water Leakage',
  'Garbage Issue',
  'Drainage Problem',
  'Electricity Problem',
  'Others',
];

export const STATUS_LIST = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
export const PRIORITY_LIST = ['Low', 'Medium', 'High', 'Critical'];

export const CATEGORY_ICONS = {
  'Street Light Damage': '💡',
  'Road Damage': '🛣️',
  'Water Leakage': '💧',
  'Garbage Issue': '🗑️',
  'Drainage Problem': '🌊',
  'Electricity Problem': '⚡',
  Others: '📋',
};

export const CATEGORY_COLORS = {
  'Street Light Damage': '#f59e0b',
  'Road Damage': '#6b7280',
  'Water Leakage': '#3b82f6',
  'Garbage Issue': '#84cc16',
  'Drainage Problem': '#06b6d4',
  'Electricity Problem': '#eab308',
  Others: '#8b5cf6',
};

export const STATUS_COLORS = {
  Pending: 'badge-pending',
  'In Progress': 'badge-progress',
  Resolved: 'badge-resolved',
  Rejected: 'badge-rejected',
};

export const PRIORITY_COLORS = {
  Low: 'bg-gray-100 text-gray-700',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const timeAgo = (dateStr) => {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
};

export const truncate = (str, n = 80) =>
  str && str.length > n ? `${str.substring(0, n)}…` : str;

export const getImageUrl = (imgPath) => {
  if (!imgPath) return null;
  if (imgPath.startsWith('http')) return imgPath;
  return imgPath; // Vite proxy handles /uploads/*
};
