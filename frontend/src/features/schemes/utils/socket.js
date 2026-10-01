// Shared authenticated Socket.IO connection for admin / department dashboards.
// The JWT is sent in the handshake so the server can put this socket into the
// correct private room (district admins, superadmins, or one department).
import { io } from 'socket.io-client';

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