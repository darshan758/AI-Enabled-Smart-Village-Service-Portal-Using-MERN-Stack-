import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { isAuthenticated, user } = useAuth();
  const home = !isAuthenticated
    ? '/login'
    : user?.role === 'admin'
    ? '/admin/dashboard'
    : user?.role === 'superadmin'
    ? '/superadmin/dashboard'
    : '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center animate-fade-in">
        <div className="text-8xl mb-6">🌾</div>
        <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Page Not Found</h2>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link to={home} className="btn-primary inline-flex items-center gap-2">
          ← Go Back Home
        </Link>
      </div>
    </div>
  );
}