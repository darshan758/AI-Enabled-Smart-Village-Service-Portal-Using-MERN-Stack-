// src/pages/Register.jsx

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';

import { useAuth } from '../context/AuthContext';
import { KARNATAKA_DISTRICTS } from '../utils/districts';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    mobile: '',
    district: '',
  });

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const validate = () => {
    if (!form.name.trim()) return 'Name is required';

    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      return 'Enter a valid email, or leave it blank';
    }

    if (form.password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    if (form.password !== form.confirm) {
      return 'Passwords do not match';
    }

    if (!/^[0-9]{10}$/.test(form.mobile)) {
      return 'Enter valid 10-digit mobile number';
    }

    if (!form.district) {
      return 'Please select your district';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate();

    if (validationError) {
      return toast.error(validationError);
    }

    setLoading(true);

    try {
      const user = await register({
        name: form.name,
        email: form.email || undefined,
        password: form.password,
        mobile: form.mobile,
        district: form.district,
      });

      toast.success(
        `Registration Successful 🎉 You can log in with your mobile number or ID: ${user?.userId || ''}`,
        { duration: 6000 }
      );

      navigate('/dashboard');
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500';

  const labelCls =
    'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="text-white w-8 h-8" />
          </div>

          <h1 className="text-3xl font-bold text-gray-800">
            Citizen Registration
          </h1>

          <p className="text-gray-500 mt-2">
            Create your Smart Village account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          {/* Name + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full Name *</label>

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={inputCls}
                placeholder="Enter full name"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label className={labelCls}>Email (optional)</label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={inputCls}
                placeholder="Enter email (optional)"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label className={labelCls}>
              Mobile Number *
            </label>

            <input
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              className={inputCls}
              placeholder="10-digit mobile number"
              maxLength={10}
              autoComplete="off"
              required
            />
          </div>

          {/* District — determines which district admin handles your complaints */}
          <div>
            <label className={labelCls}>
              District *
            </label>

            <select
              name="district"
              value={form.district}
              onChange={handleChange}
              className={inputCls}
              required
            >
              <option value="">Select your district</option>
              {KARNATAKA_DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Passwords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Password *</label>

              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPass ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Confirm Password *
              </label>

              <input
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                className={inputCls}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
          >
            {loading
              ? 'Creating Account...'
              : 'Register as Citizen'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-green-600 hover:underline font-medium"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}