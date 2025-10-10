import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

// The User interface is correct. It already includes the optional profile_image_url.
interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'student' | 'donor';
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

  // --- MODIFIED LOGIN FUNCTION ---
  const login = async (userFromLoginApi: User, token: string) => {
    try {
      // 1. Set the authorization header immediately so the next API call is authenticated
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // 2. Fetch the user's full, detailed profile from the server using their ID
      const profileResponse = await apiClient.get(`/profiles/${userFromLoginApi.id}`);
      const fullUserProfile = profileResponse.data;

      // 3. Create a final, complete user object by merging the basic login data
      //    with the detailed profile data. The profile data will overwrite any
      //    conflicting fields (like full_name), ensuring it's the most current.
      const completeUser = {
        ...userFromLoginApi, // Contains basic info like id, username, role
        ...fullUserProfile,  // Contains everything else like full_name, profile_image_url, etc.
      };

      // 4. Set the application state and save the COMPLETE user object to AsyncStorage
      setAuthState({ user: completeUser, token });
      await AsyncStorage.setItem('userSession', JSON.stringify(completeUser));
      await AsyncStorage.setItem('userToken', token);

    } catch (e) {
      console.error("AuthContext: Failed to login or fetch full profile", e);
      // If fetching the profile fails, it's a critical error.
      // It's safer to log the user out to prevent a broken state.
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

  // This updateUser function is already implemented correctly and is crucial
  // for updating the profile image *during* an active session. No changes needed here.
  const updateUser = (newUserData: Partial<User>) => {
    setAuthState(prevAuthState => {
      if (!prevAuthState.user) {
        return prevAuthState;
      }

      const updatedUser = {
        ...prevAuthState.user,
        ...newUserData,
      };
      
      // Persist the updated user data to storage
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