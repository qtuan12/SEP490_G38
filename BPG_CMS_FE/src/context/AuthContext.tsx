import React, { createContext, useContext, useEffect, useState } from 'react';
import { hasAnyRole as checkAnyRole } from '../auth/roles';
import { ApiError } from '../services/api';
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
  hasAnyRole: (allowedRoles: readonly string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearStoredSession = () => {
  localStorage.removeItem('bpg_token');
  localStorage.removeItem('bpg_refresh_token');
  localStorage.removeItem('bpg_user');
};

const INACTIVE_ACCOUNT_MESSAGE = 'Tài khoản không còn hoạt động.';

/**
 * Chỉ những lỗi thật sự về xác thực mới được phép xoá phiên. Lỗi mạng hay server 5xx
 * mà cũng xoá phiên thì user đang đăng nhập hợp lệ sẽ bị đá về /login oan.
 */
const isAuthFailure = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.status === 401 || error.status === 403;
  const message = (error as Error)?.message;
  return message === 'Unauthorized' || message === INACTIVE_ACCOUNT_MESSAGE;
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
          throw new Error(INACTIVE_ACCOUNT_MESSAGE);
        }

        setToken(storedToken);
        setUser(sessionUser);
        localStorage.setItem('bpg_user', JSON.stringify(sessionUser));
      } catch (error) {
        if (isAuthFailure(error)) {
          clearStoredSession();
          setToken(null);
          setUser(null);
        } else {
          // Lỗi mạng/server tạm thời — giữ phiên và dựng lại user từ cache để không đá về /login.
          const cachedUser = localStorage.getItem('bpg_user');
          if (cachedUser) {
            setToken(storedToken);
            setUser(JSON.parse(cachedUser) as UserProfile);
          } else {
            setToken(null);
            setUser(null);
          }
        }
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

  const hasAnyRole = (allowedRoles: readonly string[]) =>
    checkAnyRole(user?.roles?.length ? user.roles : user ? [user.role] : undefined, allowedRoles);

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
        hasAnyRole,
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
