import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { storage } from '../utils/storage';

const AuthContext = createContext();

const DEMO_USER = {
  id: 'demo-user-1',
  name: 'Sarvatha',
  email: 'sarvatha@example.com',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => storage.get('current_user', DEMO_USER));
  const [token, setToken] = useState(() => storage.get('auth_token', 'demo-token-active'));
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    async function verifyUser() {
      if (token && token !== 'demo-token-active') {
        api.setToken(token);
        try {
          const res = await api.getMe();
          if (res?.user) {
            setUser(res.user);
            storage.set('current_user', res.user);
          }
        } catch (e) {
          console.warn('[AuthProvider] Token verification fallback:', e);
        }
      }
    }
    verifyUser();
  }, [token]);

  const login = async (email, password) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
      setToken(res.token);
      storage.set('current_user', res.user);
      storage.set('auth_token', res.token);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await api.register(name, email, password);
      setUser(res.user);
      setToken(res.token);
      storage.set('current_user', res.user);
      storage.set('auth_token', res.token);
      return res;
    } catch (err) {
      setAuthError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    storage.remove('current_user');
    storage.remove('auth_token');
    api.clearToken();
  };

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        authError,
        login,
        signup,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
