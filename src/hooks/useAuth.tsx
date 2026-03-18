import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getStoredUser, isAuthenticated } from '@/lib/api';
import { User } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      if (isAuthenticated()) {
        const data = await api.auth.me();
        setUser(data.user);
        localStorage.setItem('nexus_user', JSON.stringify(data.user));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      localStorage.removeItem('nexus_access_token');
      localStorage.removeItem('nexus_user');
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (isAuthenticated()) {
        await refreshUser();
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
