
// URL de producción en Render
const PROD_API_URL = 'https://backednnuevo.onrender.com';
// Para este entorno, usamos Render tanto en dev como en prod.
// Si algún día quieres volver a usar backend local en desarrollo, cambia DEV_API_URL.
const DEV_API_URL = PROD_API_URL;

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const API_URL = API_BASE_URL;

export default {
  API_BASE_URL,
  TIMEOUT: 15000, // 15 segundos
};
