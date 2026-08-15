import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, Tag, Hash } from 'lucide-react';
import {
  STATUS_COLORS, PRIORITY_COLORS, CATEGORY_ICONS, formatDateTime, truncate,
} from '../utils/helpers';

export default function ComplaintCard({ complaint, showUser = false }) {
  const {
    _id, trackingId, title, description, category, status, priority,
    image, latitude, longitude, createdAt, user,
  } = complaint;

  return (
    <Link to={`/complaint/${_id}`} className="card p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200 group animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-primary-600 truncate">
            {title}
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
            <Hash size={11} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 font-mono">{trackingId}</span>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[status]}`}>
          {status}
        </span>
      </div>

      {/* Image */}
      {image && (
        <img
          src={image}
          alt={title}
          className="w-full h-36 object-cover rounded-xl bg-gray-100 dark:bg-gray-700"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}

      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        {truncate(description, 100)}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
          <span>{CATEGORY_ICONS[category]}</span> {category}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[priority]}`}>
          {priority}
        </span>
        {(latitude && longitude) && (
          <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-1 rounded-full">
            <MapPin size={10} /> Location
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        {showUser && user && (
          <span className="text-xs text-gray-500">{user.name} · {user.village || 'Unknown'}</span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
          <Clock size={11} /> {formatDateTime(createdAt)}
        </span>
      </div>
    </Link>
  );
}
