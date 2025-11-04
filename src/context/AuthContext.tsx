import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

// CORRECTED: 'others' should be lowercase to match the database enum
interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student' | 'others';
  profile_image_url?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextType {
  authState: AuthState;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (newUserData: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, token: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const userString = await AsyncStorage.getItem('userSession');
        const tokenString = await AsyncStorage.getItem('userToken');

        if (userString && tokenString) {
          const user = JSON.parse(userString);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokenString}`;
          setAuthState({ user, token: tokenString });
        }
      } catch (e) {
        console.error("AuthContext: Failed to load session", e);
        await AsyncStorage.multiRemove(['userSession', 'userToken']);
      }
      finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (userFromLoginApi: User, token: string) => {
    try {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // This call will now receive the correct user ID from the backend
      const profileResponse = await apiClient.get(`/profiles/${userFromLoginApi.id}`);
      const fullUserProfile = profileResponse.data;

      // The fullUserProfile now contains the correct ID, so merging is safe
      const completeUser = {
        ...userFromLoginApi,
        ...fullUserProfile,
      };

      setAuthState({ user: completeUser, token });
      await AsyncStorage.setItem('userSession', JSON.stringify(completeUser));
      await AsyncStorage.setItem('userToken', token);

    } catch (e) {
      console.error("AuthContext: Failed to login or fetch full profile", e);
      await logout();
    }
  };

  const logout = async () => {
    try {
      delete apiClient.defaults.headers.common['Authorization'];
      setAuthState({ user: null, token: null });
      await AsyncStorage.multiRemove(['userSession', 'userToken']);
    } catch (e) { console.error("AuthContext: Failed to clear session", e); }
  };

  const updateUser = (newUserData: Partial<User>) => {
    setAuthState(prevAuthState => {
      if (!prevAuthState.user) {
        return prevAuthState;
      }

      const updatedUser = {
        ...prevAuthState.user,
        ...newUserData,
      };

      AsyncStorage.setItem('userSession', JSON.stringify(updatedUser)).catch(e => {
        console.error("AuthContext: Failed to save updated user session", e);
      });

      return {
        ...prevAuthState,
        user: updatedUser,
      };
    });
  };

  const value = { authState, login, logout, isLoading, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');

  return {
    user: context.authState.user,
    token: context.authState.token,
    login: context.login,
    logout: context.logout,
    isLoading: context.isLoading,
    updateUser: context.updateUser,
  };
};