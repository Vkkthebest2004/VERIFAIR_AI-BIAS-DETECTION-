/**
 * Central API configuration.
 *
 * In development  → defaults to http://localhost:8000
 * On Vercel / prod → set NEXT_PUBLIC_API_URL environment variable
 *                    (e.g. https://your-backend.onrender.com)
 */
export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const API = `${API_BASE_URL}/api/v1`;
