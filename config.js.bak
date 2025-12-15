// Configuracion centralizada del backend (ajusta host segun plataforma)
import { Platform } from 'react-native';

// Android emulator necesita llegar al host como 10.0.2.2; iOS/simulador y web pueden usar localhost.
const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_URL = `http://${host}:4001`;
