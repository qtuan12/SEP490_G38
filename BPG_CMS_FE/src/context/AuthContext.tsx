import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import type { LoginCredentials, UserProfile } from '../services/authService';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const VALID_ROLES = ['admin', 'technicalmanager', 'projectleader', 'siteengineer', 'accountant', 'director'];

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('bpg_token');
      const storedUser = localStorage.getItem('bpg_user');

      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && VALID_ROLES.includes(parsed.role)) {
            setToken(storedToken);
            setUser(parsed);
          } else {
            // Role cũ hoặc không hợp lệ → clear session
            localStorage.removeItem('bpg_token');
            localStorage.removeItem('bpg_user');
          }
        } catch {
          localStorage.removeItem('bpg_token');
          localStorage.removeItem('bpg_user');
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('bpg_token', response.token);
      localStorage.setItem('bpg_user', JSON.stringify(response.user));
    } catch (error) {
      localStorage.removeItem('bpg_token');
      localStorage.removeItem('bpg_user');
      setUser(null);
      setToken(null);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
    localStorage.removeItem('bpg_token');
    localStorage.removeItem('bpg_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
