const PROD_API_URL = 'https://api.megarifas.com.ve';

// Para este entorno, usamos Render tanto en dev como en prod.
// Si algún día quieres volver a usar backend local en desarrollo, cambia DEV_API_URL.
const DEV_API_URL = PROD_API_URL;

export const ENV = {
	apiUrl: __DEV__ ? DEV_API_URL : PROD_API_URL,
	timeout: 15000,
};
