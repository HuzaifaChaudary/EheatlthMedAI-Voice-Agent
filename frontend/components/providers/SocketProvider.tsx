"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthContext } from './AuthProvider';
import { tokenManager } from '@/lib/auth';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { user, isAuth } = useAuthContext();

    useEffect(() => {
        if (!isAuth || !user) return;

        const token = tokenManager.getToken();
        if (!token) return;

        // Initialize socket connection - use base URL (remove /api if present)
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const baseUrl = apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:5000';
        const socketInstance = io(baseUrl, {
                auth: {
                    token: token
                },
            transports: ['websocket'],
                reconnection: true,
            reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            socketInstance.on('connect', () => {
            console.log('Socket connected:', socketInstance.id);
                setIsConnected(true);
            });

            socketInstance.on('disconnect', () => {
                console.log('Socket disconnected');
                setIsConnected(false);
            });

            socketInstance.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
                setIsConnected(false);
            });

            setSocket(socketInstance);

            return () => {
                socketInstance.disconnect();
            };
    }, [isAuth, user]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
