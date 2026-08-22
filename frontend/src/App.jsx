import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Toaster } from 'react-hot-toast';

import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Register from './pages/Register';

import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

import ComplaintForm from './pages/ComplaintForm';
import ComplaintTracking from './pages/ComplaintTracking';
import ComplaintMap from './pages/ComplaintMap';
import ComplaintDetail from './pages/ComplaintDetail';

import NotFound from './pages/NotFound';


// ─────────────────────────────────────────────────────────────
// Route Guards
// ─────────────────────────────────────────────────────────────

// Any Logged In User
const PrivateRoute = ({ children }) => {

  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage />;
  }

  return isAuthenticated
    ? children
    : <Navigate to="/login" replace />;
};


// Citizen Only
const UserRoute = ({ children }) => {

  const { isAuthenticated, user, loading } = useAuth();

  if (loading || (isAuthenticated && !user)) {
    return <LoadingSpinner fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admins should not open citizen dashboard
  if (['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};


// Admin + SuperAdmin
const AdminRoute = ({ children }) => {

  const { isAuthenticated, user, loading } = useAuth();

  if (loading || (isAuthenticated && !user)) {
    return <LoadingSpinner fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};


// SuperAdmin Only
const SuperAdminRoute = ({ children }) => {

  const { isAuthenticated, user, loading } = useAuth();

  if (loading || (isAuthenticated && !user)) {
    return <LoadingSpinner fullPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== 'superadmin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};


// Public Routes
const PublicRoute = ({ children }) => {

  const { isAuthenticated, user, loading } = useAuth();

  if (loading || (isAuthenticated && !user)) {
    return <LoadingSpinner fullPage />;
  }

  if (isAuthenticated) {

    // Redirect based on role
    if (user.role === 'superadmin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    }

    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return children;
};


// ─────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────

export default function App() {

  return (
    <AuthProvider>

      <BrowserRouter>

        <ErrorBoundary>

          <Routes>

            {/* Public Routes */}
            <Route
              path="/"
              element={<Navigate to="/civic-issues" replace />}
            />

            <Route
              path="/civic-issues"
              element={<Landing />}
            />

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            <Route
              path="/admin/login"
              element={
                <PublicRoute>
                  <AdminLogin />
                </PublicRoute>
              }
            />

            <Route
              path="/register"
              element={<Register />}
            />

            <Route
              path="/track"
              element={<ComplaintTracking />}
            />


            {/* Citizen Routes */}
            <Route
              path="/dashboard"
              element={
                <UserRoute>
                  <UserDashboard />
                </UserRoute>
              }
            />

            <Route
              path="/report"
              element={
                <UserRoute>
                  <ComplaintForm />
                </UserRoute>
              }
            />

            <Route
              path="/map"
              element={
                <UserRoute>
                  <ComplaintMap />
                </UserRoute>
              }
            />


            {/* Shared Protected Route */}
            <Route
              path="/complaint/:id"
              element={
                <PrivateRoute>
                  <ComplaintDetail />
                </PrivateRoute>
              }
            />


            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />


            {/* Super Admin Routes */}
            <Route
              path="/superadmin/dashboard"
              element={
                <SuperAdminRoute>
                  <SuperAdminDashboard />
                </SuperAdminRoute>
              }
            />


            {/* 404 */}
            <Route
              path="*"
              element={<NotFound />}
            />

          </Routes>

        </ErrorBoundary>

        <ToastContainer
          position="top-right"
          autoClose={3000}
        />

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '12px', fontSize: '14px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />

      </BrowserRouter>

    </AuthProvider>
  );
}