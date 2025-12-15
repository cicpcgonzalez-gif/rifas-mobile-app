import axios from 'axios';
import { ENV } from '../config/env';
import * as SecureStore from 'expo-secure-store';

let token: string | null = null;

export const api = axios.create({
  baseURL: ENV.apiUrl,
  timeout: ENV.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  if (!token) token = await SecureStore.getItemAsync('jwt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Intenta extraer el mensaje de error del backend
      const backendError = error.response.data?.error || error.response.data?.message;
      // Si el backend devuelve HTML (común en 404/500 de Render), data será string
      if (typeof error.response.data === 'string') {
         // Si es HTML, probablemente sea un error de servidor o URL incorrecta
         console.log('HTML Response:', error.response.data);
         throw new Error(`Error del servidor (${error.response.status})`);
      }
      throw new Error(backendError || 'Error en la API');
    } else if (error.request) {
      throw new Error('No se pudo conectar con el servidor');
    } else {
      throw new Error('Error desconocido');
    }
  }
);

// Verifica el estado del backend (solo health; el backend no expone /status)
export async function checkApi() {
  try {
    const health = await api.get('/health');
    return { health: health.data };
  } catch (err: any) {
    console.log('checkApi error:', err.message, err);
    throw new Error(err.message || 'No se pudo conectar con el backend');
  }
}

// Listar rifas
export async function listRaffles() {
  try {
    console.log(ENV.apiUrl);
    const res = await api.get('/raffles');
    return res.data;
  } catch (err: any) {
    console.log('listRaffles error:', err.message, err);
    throw new Error(err.message || 'No se pudo obtener la lista de rifas');
  }
}

// Crear rifa
export async function createRaffle(raffle: { title: string; description: string }) {
  try {
    console.log(ENV.apiUrl);
    const res = await api.post('/raffles', raffle);
    return res.data;
  } catch (err: any) {
    console.log('createRaffle error:', err.message, err);
    throw new Error(err.message || 'No se pudo crear la rifa');
  }
}

// Login y manejo de JWT
export async function login(credentials: { email: string; password: string }) {
  try {
    console.log(ENV.apiUrl);
    const res = await api.post('/auth/login', credentials);
    // El backend devuelve { accessToken, refreshToken, user, ... }
    token = res.data.accessToken; 
    if (token) {
      await SecureStore.setItemAsync('jwt_token', token);
    }
    return res.data;
  } catch (err: any) {
    console.log('login error:', err.message, err);
    // Propagar el error exacto del backend para detectar si es "no verificado"
    throw err; 
  }
}

export async function verifyAccount(email: string, code: string) {
  try {
    const res = await api.post('/verify-email', { email, code });
    return res.data;
  } catch (err: any) {
    throw new Error(err.response?.data?.error || 'Error al verificar cuenta');
  }
}

export async function resendVerificationCode(email: string) {
  try {
    const res = await api.post('/resend-code', { email });
    return res.data;
  } catch (err: any) {
    // El interceptor ya procesó el error, así que solo lo relanzamos
    throw err;
  }
}

export async function loadToken() {
  token = await SecureStore.getItemAsync('jwt_token');
  return token;
}

export async function logout() {
  token = null;
  await SecureStore.deleteItemAsync('jwt_token');
}

