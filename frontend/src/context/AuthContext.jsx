import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
} from 'react';

import axios from '../api/axios';

const AuthContext = createContext(null);

// Initial State
const initialState = {
  user: null,
  token: localStorage.getItem('token') || null,
  loading: true,
  isAuthenticated: false,
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {

    // LOGIN SUCCESS
    case 'LOGIN_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));

      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      };

    // LOAD USER
    case 'LOAD_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
      };

    // LOGOUT
    case 'LOGOUT':
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };

    // SET LOADING
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    // AUTH ERROR
    case 'AUTH_ERROR':
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };

    default:
      return state;
  }
};

// Provider
export const AuthProvider = ({ children }) => {

  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load User on App Start
  useEffect(() => {
    const loadUser = async () => {

      const token = localStorage.getItem('token');

      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        // Optional API call to verify token & get fresh user
        const { data } = await axios.get('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        dispatch({
          type: 'LOAD_USER',
          payload: data.user,
        });

      } catch (error) {

        // fallback from localStorage
        const storedUser = localStorage.getItem('user');

        if (storedUser) {
          try {
            dispatch({
              type: 'LOAD_USER',
              payload: JSON.parse(storedUser),
            });
          } catch {
            dispatch({ type: 'AUTH_ERROR' });
          }
        } else {
          dispatch({ type: 'AUTH_ERROR' });
        }
      }
    };

    loadUser();
  }, []);

  // LOGIN
  const login = async (identifier, password) => {

    const { data } = await axios.post('/auth/login', {
      identifier,
      password,
    });

    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: data,
    });

    return data.user;
  };

  // REGISTER
  const register = async (formData) => {

    const { data } = await axios.post('/auth/register', formData);

    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: data,
    });

    return data.user;
  };

  // LOGOUT
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  // UPDATE USER
  const updateUser = (user) => {
    localStorage.setItem('user', JSON.stringify(user));

    dispatch({
      type: 'LOAD_USER',
      payload: user,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook
export const useAuth = () => {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};