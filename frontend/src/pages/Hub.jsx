// src/pages/Hub.jsx
//
// The Smart Village Portal umbrella page — the very first screen anyone sees.
// Each "container" below represents one independent feature/sub-project.
// Clicking a container takes you into that feature's own interface.
//
// To add a new feature later (another sub-project, a chatbot, etc.), just add
// a new object to the FEATURES array below — nothing else needs to change.

import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileCheck2, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import FaqChatbot from '../components/FaqChatbot/FaqChatbot';

const FEATURES = [
  {
    id: 'civic-issues',
    title: 'Crowdsource Civic Issue Detection',
    description:
      'Report local problems — road damage, broken street lights, garbage, water leaks — with a photo and location. Track status until resolved.',
    icon: AlertTriangle,
    to: '/login',
    status: 'active',
    color: 'primary',
  },
  {
    id: 'scheme-checker',
    title: 'Government Scheme Eligibility Checker',
    description:
      'Find out which government welfare schemes you qualify for, and what documents you need, based on your details.',
    icon: FileCheck2,
    // Merged in as a real internal route — same app, same backend, same build.
    to: '/schemes',
    status: 'active',
    color: 'blue',
  },
  {
    id: 'agri-prices',
    title: 'Agricultural Market Price Checker',
    description:
      "Check today's live mandi prices for common crops across Karnataka districts, sourced directly from the government's Agmarknet system.",
    icon: TrendingUp,
    to: '/agri',
    status: 'active',
    color: 'green',
  },
  // Add future features here, e.g.:
  // {
  //   id: 'chatbot',
  //   title: 'Village Assistant Chatbot',
  //   description: 'Ask questions in Kannada or English about village services.',
  //   icon: MessageCircle,
  //   to: '/chatbot',
  //   status: 'coming-soon',
  //   color: 'purple',
  // },
];

const COLOR_CLASSES = {
  primary: {
    iconBg: 'bg-primary-100 dark:bg-primary-900/40',
    iconText: 'text-primary-600',
    badge: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30',
    ring: 'hover:ring-primary-300',
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconText: 'text-blue-600',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30',
    ring: 'hover:ring-blue-300',
  },
  purple: {
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconText: 'text-purple-600',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30',
    ring: 'hover:ring-purple-300',
  },
  green: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconText: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30',
    ring: 'hover:ring-emerald-300',
  },
};

export default function Hub() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex flex-col">

      {/* Header */}
      <header className="px-6 py-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-xl shadow">🌾</div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white leading-tight">Smart Village Portal</h1>
          <p className="text-xs text-gray-500">AI-Enabled Village Service Platform</p>
        </div>
      </header>

      {/* Intro */}
      <div className="text-center px-6 mt-6 mb-10">
        <span className="inline-block text-sm font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-4 py-1.5 rounded-full mb-4">
          Choose a service
        </span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">
          One Portal, Many Village Services
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xl mx-auto">
          Smart Village brings together everything a citizen needs — pick a service below to get started.
        </p>
      </div>

      {/* Feature Containers */}
      <div className="flex-1 px-6 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const colors = COLOR_CLASSES[f.color] || COLOR_CLASSES.primary;
            const isActive = f.status === 'active';

            const cardInner = (
              <div
                className={`relative h-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm transition-all ${
                  isActive
                    ? `hover:shadow-lg hover:-translate-y-0.5 hover:ring-2 ${colors.ring} cursor-pointer`
                    : 'opacity-70 cursor-not-allowed'
                }`}
              >
                {!isActive && (
                  <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${colors.iconBg} ${colors.iconText}`}>
                  <Icon size={26} />
                </div>

                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {f.title}
                </h3>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {f.description}
                </p>

                {isActive && (
                  <span className={`inline-flex items-center gap-1 text-sm font-semibold ${colors.iconText}`}>
                    Open <ArrowRight size={15} />
                  </span>
                )}
              </div>
            );

            if (!isActive) {
              return (
                <div key={f.id} className="h-full">
                  {cardInner}
                </div>
              );
            }

            return f.external ? (
              <a key={f.id} href={f.to} className="block h-full">
                {cardInner}
              </a>
            ) : (
              <Link key={f.id} to={f.to} className="block h-full">
                {cardInner}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 pb-6 flex items-center justify-center gap-1.5">
        <Sparkles size={12} /> More village services will appear here as they're added
      </footer>

      {/* FAQ chatbot widget — front page only, self-contained, no backend dependency */}
      <FaqChatbot />
    </div>
  );
}