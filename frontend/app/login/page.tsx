
"use client";

import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function LoginPage() {
    const { login } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            if (isLogin) {
                // Login
                const formData = new FormData();
                formData.append("username", email);
                formData.append("password", password);

                const res = await axios.post("http://localhost:8000/api/v1/auth/token", formData);
                login(res.data.access_token);
            } else {
                // Register
                await axios.post("http://localhost:8000/api/v1/auth/register", {
                    email,
                    password,
                    full_name: "New User"
                });
                // Auto-login after register
                const formData = new FormData();
                formData.append("username", email);
                formData.append("password", password);
                const res = await axios.post("http://localhost:8000/api/v1/auth/token", formData);
                login(res.data.access_token);
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.detail
                ? (typeof err.response.data.detail === 'string' ? err.response.data.detail : JSON.stringify(err.response.data.detail))
                : "An error occurred.";
            setError(msg);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md glass-card">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-indigo-500/20 rounded-full">
                            <CheckCircle className="w-10 h-10 text-indigo-400" />
                        </div>
                    </div>
                    <CardTitle className="text-center text-2xl text-glow">
                        {isLogin ? "Verifair Login" : "Create Account"}
                    </CardTitle>
                    <p className="text-center text-slate-400 text-sm">
                        Enter the Data Lab
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <Button type="submit" className="w-full mt-4">
                            {isLogin ? "Sign In" : "Register"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm text-indigo-400 hover:text-indigo-300 underline"
                        >
                            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
                        </button>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
