import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

let socket;

export const useSocket = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    socket = io(import.meta.env.VITE_API_URL, { withCredentials: true });

    socket.on('connect', () => {
      socket.emit('join', user._id);
    });

    socket.on('notification', (data) => {
      toast.info(data.message, { icon: '🔔' });
    });

    return () => socket?.disconnect();
  }, [user]);
};