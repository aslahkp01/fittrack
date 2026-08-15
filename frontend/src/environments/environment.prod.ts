export const environment = {
  production: true,
  apiUrl: (typeof window !== 'undefined' && ((window as any).__API_URL__ || localStorage.getItem('API_URL'))) 
    || 'https://fittrack-backend.onrender.com/api'
};
