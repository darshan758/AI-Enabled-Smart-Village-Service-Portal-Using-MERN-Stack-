// Shared authenticated Socket.IO connection for admin / department dashboards.
// The JWT is sent in the handshake so the server can put this socket into the
// correct private room (district admins, superadmins, or one department).
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import MapComponent from './MapComponent';
import LoadingSpinner from './LoadingSpinner';
import api from '../utils/api';

let socket = null;

export function getStaffSocket() {
  if (!localStorage.getItem('token')) return null;
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || undefined, {
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function closeStaffSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default function LiveComplaintMap({ endpoint }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const staffSocket = getStaffSocket();
    const updateComplaint = (complaint) => {
      if (complaint.latitude == null || complaint.longitude == null) return;

      setComplaints((current) => {
        const existingIndex = current.findIndex(({ _id }) => _id === complaint._id);
        if (existingIndex === -1) return [complaint, ...current];

        const updated = [...current];
        updated[existingIndex] = complaint;
        return updated;
      });
    };

    staffSocket?.on('new_complaint', updateComplaint);
    staffSocket?.on('sla_escalation', updateComplaint);

    api.get(endpoint)
      .then(({ data }) => {
        if (active) setComplaints(data.complaints || []);
      })
      .catch(() => {
        if (active) setError('Failed to load complaint map.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      staffSocket?.off('new_complaint', updateComplaint);
      staffSocket?.off('sla_escalation', updateComplaint);
    };
  }, [endpoint]);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size="lg" text="Loading map data..." /></div>;
  }

  if (error) {
    return <div role="alert" className="py-8 text-center text-sm text-red-600">{error}</div>;
  }

  return (
    <section aria-label="Live complaint map">
      <p className="mb-3 text-sm text-gray-500">{complaints.length} complaints with location data</p>
      <MapComponent complaints={complaints} height="520px" />
    </section>
  );
}