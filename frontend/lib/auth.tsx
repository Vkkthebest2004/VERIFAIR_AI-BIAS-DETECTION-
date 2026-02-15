
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

// --- Types ---
interface User {
    id: number;
    email: string;
    full_name: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string) => void;
    logout: () => void;
    getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { },
    getToken: () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Helper to get token
    const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const logout = React.useCallback(() => {
        localStorage.removeItem("access_token");
        setUser(null);
        router.push("/landing");
    }, [router]);

    useEffect(() => {
        const checkUser = async () => {
            const token = getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await axios.get("http://localhost:8000/api/v1/auth/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUser(res.data);
            } catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 401) {
                    console.log("Session expired or invalid.");
                    logout();
                } else {
                    console.error("Auth check failed", err);
                }
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, [logout]);

    const login = (token: string) => {
        localStorage.setItem("access_token", token);
        axios.get("http://localhost:8000/api/v1/auth/me", {
            headers: { Authorization: `Bearer ${token}` }
        }).then(res => {
            setUser(res.data);
            router.push("/dashboard");
        }).catch(e => console.error(e));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, getToken }}>
            {children}
        </AuthContext.Provider>
    );
};
