import React, { createContext, useContext, useEffect, useState } from 'react';
import { hasPermission } from '../auth/permissions';
import type { SystemPermissionValue } from '../auth/permissions';
import { authService } from '../services/authService';
import type { LoginCredentials, UserProfile } from '../services/authService';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<UserProfile>;
  logout: () => void;
  updateUser: (partial: Partial<UserProfile>) => void;
  hasSystemPermission: (permission: SystemPermissionValue | string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearStoredSession = () => {
  localStorage.removeItem('bpg_token');
  localStorage.removeItem('bpg_refresh_token');
  localStorage.removeItem('bpg_user');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('bpg_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const sessionUser = await authService.getSessionUser();
        if (sessionUser.status !== 'active') {
          throw new Error('Tài khoản không còn hoạt động.');
        }

        setToken(storedToken);
        setUser(sessionUser);
        localStorage.setItem('bpg_user', JSON.stringify(sessionUser));
      } catch {
        clearStoredSession();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<UserProfile> => {
    try {
      const response = await authService.login(credentials);
      localStorage.setItem('bpg_token', response.token);
      localStorage.setItem('bpg_refresh_token', response.refreshToken);
      localStorage.setItem('bpg_user', JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
      return response.user;
    } catch (error) {
      clearStoredSession();
      setUser(null);
      setToken(null);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    clearStoredSession();
    setToken(null);
    setUser(null);
  };

  const updateUser = (partial: Partial<UserProfile>) => {
    setUser((previous) => {
      if (!previous) return previous;
      const updated = { ...previous, ...partial };
      localStorage.setItem('bpg_user', JSON.stringify(updated));
      return updated;
    });
  };

  const hasSystemPermission = (permission: SystemPermissionValue | string) =>
    hasPermission(user?.systemPermissions, permission);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        login,
        logout,
        updateUser,
        hasSystemPermission,
      }}
    >
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
