import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Eye,
  EyeOff,
  LogIn,
  ArrowLeft,
  User,
} from 'lucide-react';

import { toast } from 'react-toastify';

export default function Login() {

  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    identifier: '',
    password: '',
  });

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handle Input Change
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Handle Login
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.identifier || !form.password) {
      return toast.error('Please fill all fields');
    }

    setLoading(true);

    try {

      const user = await login(
        form.identifier,
        form.password
      );

      // Citizen login only — admins/superadmins must use the Admin Portal
      if (user.role === 'admin' || user.role === 'superadmin') {
        logout();
        toast.error('⚠️ Please login through the Admin Portal, not here.', { duration: 5000 });
        setLoading(false);
        return;
      }

      toast.success(`Welcome back, ${user.name}! 👋`);
      navigate('/dashboard');

    } catch (err) {

      toast.error(
        err.response?.data?.message ||
        'Login failed. Check your credentials.'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4">

      <div className="w-full max-w-md animate-slide-up">

        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-600 text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Home
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">

          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-lg mb-4">
            <User size={30} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Smart Village Login
          </h1>

          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Complaint Management System
          </p>

        </div>

        {/* Login Card */}
        <div className="card p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl">

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email / ID */}
            <div>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Mobile Number, Email, or Citizen ID
              </label>

              <input
                name="identifier"
                type="text"
                value={form.identifier}
                onChange={handleChange}
                placeholder="9876543210, you@example.com, or SV2026-USER-1001"
                className="input-field w-full"
                autoComplete="username"
              />

              <p className="text-xs text-gray-400 mt-1">
                Login using your Email or Citizen ID
              </p>

            </div>

            {/* Password */}
            <div>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>

              <div className="relative">

                <input
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input-field w-full pr-10"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>

              </div>

            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >

              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}

              {loading ? 'Signing in...' : 'Sign In'}

            </button>

          </form>

          {/* Demo Credentials */}
          <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-700 dark:text-blue-300 space-y-1">

            <p className="font-semibold">
              Demo Citizen:
            </p>

            <p>
              Email: user@demo.com
            </p>

            <p>
              Password: Demo@123
            </p>

          </div>

        </div>

        {/* Footer */}
        <div className="text-center mt-4 space-y-2">

          <p className="text-sm text-gray-500 dark:text-gray-400">

            Don't have an account?{' '}

            <Link
              to="/register"
              className="text-primary-600 font-semibold hover:underline"
            >
              Register here
            </Link>

          </p>

          <p className="text-sm text-gray-400">

            <Link
              to="/track"
              className="hover:text-primary-600"
            >
              🔍 Track complaint without login
            </Link>

          </p>

          <p className="text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">

            Are you an admin?{' '}

            <Link
              to="/admin/login"
              className="text-indigo-600 font-medium hover:underline"
            >
              Admin Portal →
            </Link>

          </p>

        </div>

      </div>

    </div>
  );
}