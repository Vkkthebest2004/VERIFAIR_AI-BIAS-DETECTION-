/**
 * Central API configuration.
 *
 * In development  → defaults to http://localhost:8000
 * On Vercel / prod → set NEXT_PUBLIC_API_URL environment variable
 *                    (e.g. https://your-backend.onrender.com)
 */
import axios from 'axios';

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const API = `${API_BASE_URL}/api/v1`;

// IMPORTANT: Free ngrok blocks API requests from browsers by serving an HTML warning page.
// We MUST send these headers with EVERY request, otherwise Axios JSON parsing fails.
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
axios.defaults.headers.common['User-Agent'] = 'Custom-Agent';
