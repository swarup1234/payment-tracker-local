import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, loginUser, registerUser, logoutUser } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [quotas, setQuotas] = useState({
    services: { current: 0, limit: 10 },
    customers: { current: 0, limit: 5000 },
    transactions: { current: 0, limit: 100000 },
  });
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    try {
      const data = await getMe();
      setUser(data.user);
      if (data.quotas) {
        setQuotas(data.quotas);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    setUser(data.user);
    await refreshMe();
    return data;
  };

  const register = async (name, email, password) => {
    const data = await registerUser({ name, email, password });
    setUser(data.user);
    await refreshMe();
    return data;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, quotas, loading, login, register, logout, refreshMe }}>
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
