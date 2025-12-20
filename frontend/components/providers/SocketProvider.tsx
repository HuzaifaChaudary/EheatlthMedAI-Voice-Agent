"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

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
    const { data: session } = useSession();

    useEffect(() => {
        if (!session?.user) return;

        // Initialize socket connection
        const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
            auth: {
                token: (session as any).accessToken // Assuming accessToken is available in session
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
    }, [session]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
