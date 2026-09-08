import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  device_id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, key: string) => Promise<{ error?: string }>;
  register: (username: string, key: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const ACCESS_KEY = 'homelander';
const SESSION_STORAGE_KEY = 'logged_in_username_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    localStorage.removeItem('logged_in_username');
    const savedUsername = localStorage.getItem(SESSION_STORAGE_KEY);
    
    if (savedUsername) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', savedUsername)
        .maybeSingle();

      if (data && !error) {
        setUser(data as User);
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  };

  const login = async (username: string, key: string): Promise<{ error?: string }> => {
    const trimmedUsername = username.trim().toLowerCase();

    if (!key?.trim()) {
      return { error: 'Access key is required' };
    }
    if (key.trim() !== ACCESS_KEY) {
      return { error: 'Invalid access key' };
    }
    
    if (!trimmedUsername) {
      return { error: 'Username is required' };
    }

    if (trimmedUsername.length < 3) {
      return { error: 'Username must be at least 3 characters' };
    }

    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      return { error: 'Username can only contain letters, numbers, and underscores' };
    }

    // Check if username exists
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', trimmedUsername)
      .maybeSingle();

    if (error) {
      return { error: 'Failed to check username' };
    }

    if (!existingUser) {
      return { error: 'Username not found. Please register first.' };
    }

    // Log them in
    localStorage.setItem(SESSION_STORAGE_KEY, trimmedUsername);
    setUser(existingUser as User);
    return {};
  };

  const register = async (username: string, key: string): Promise<{ error?: string }> => {
    const trimmedUsername = username.trim().toLowerCase();

    if (!key?.trim()) {
      return { error: 'Access key is required' };
    }
    if (key.trim() !== ACCESS_KEY) {
      return { error: 'Invalid access key' };
    }
    
    if (!trimmedUsername) {
      return { error: 'Username is required' };
    }

    if (trimmedUsername.length < 3) {
      return { error: 'Username must be at least 3 characters' };
    }

    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      return { error: 'Username can only contain letters, numbers, and underscores' };
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('username', trimmedUsername)
      .maybeSingle();

    if (existingUser) {
      return { error: 'Username already taken. Please choose another.' };
    }

    // Create new user with unique device_id
    const newDeviceId = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from('users')
      .insert({ device_id: newDeviceId, username: trimmedUsername })
      .select()
      .single();

    if (error) {
      return { error: 'Failed to create account' };
    }

    localStorage.setItem(SESSION_STORAGE_KEY, trimmedUsername);
    setUser(data as User);
    return {};
  };

  const logout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
