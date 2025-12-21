'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { tokenManager, sessionManager, isAuthenticated, clearAuth } from '@/lib/auth';
import { get } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuth: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  const refreshUser = async () => {
    try {
      if (!isAuthenticated()) {
        setUser(null);
        setIsAuth(false);
        setLoading(false);
        return;
      }

      // Get user from session or fetch from API
      const session = sessionManager.getUser();
      if (session) {
        setUser({
          id: session.userId,
          email: session.email,
          role: session.role,
          firstName: session.firstName,
          lastName: session.lastName
        });
        setIsAuth(true);
        setLoading(false);
        return;
      }

      // Fetch user from API
      const response = await get('/users/me');
      if (response.data?.user) {
        const userData = response.data.user;
        setUser({
          id: userData.id?.toString() || userData.userId?.toString(),
          email: userData.email,
          role: userData.role,
          firstName: userData.first_name || userData.firstName,
          lastName: userData.last_name || userData.lastName
        });
        sessionManager.createSession(userData);
        setIsAuth(true);
      } else {
        clearAuth();
        setIsAuth(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      clearAuth();
      setIsAuth(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setIsAuth(false);
    router.push('/login');
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuth, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

