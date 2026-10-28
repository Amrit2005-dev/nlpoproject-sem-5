import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { storage } from '../utils/storage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => storage.get('current_user', null));
  const [token, setToken] = useState(() => storage.get('auth_token', null));
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    async function verifyUser() {
      if (token) {
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
      setIsLoading(false);
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
      setAuthError(err.message || 'Signup failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async () => {
    return login('sarvatha@example.com', 'password123');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    storage.remove('current_user');
    storage.remove('auth_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        authError,
        login,
        signup,
        demoLogin,
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
