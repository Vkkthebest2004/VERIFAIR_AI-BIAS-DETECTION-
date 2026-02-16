"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { API } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Eye,
    EyeOff,
    ArrowRight,
    Loader2,
    Mail,
    Lock,
    User,

} from "lucide-react";

export default function LoginPage() {
    const { login, user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!authLoading && user) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                const formData = new FormData();
                formData.append("username", email);
                formData.append("password", password);
                const res = await axios.post(
                    `${API}/auth/token`,
                    formData
                );
                login(res.data.access_token);
            } else {
                await axios.post(`${API}/auth/register`, {
                    email,
                    password,
                    full_name: fullName || "User",
                });
                const formData = new FormData();
                formData.append("username", email);
                formData.append("password", password);
                const res = await axios.post(
                    `${API}/auth/token`,
                    formData
                );
                login(res.data.access_token);
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string | object } } };
            const detail = axiosErr.response?.data?.detail;
            const msg = detail
                ? typeof detail === "string"
                    ? detail
                    : JSON.stringify(detail)
                : "An error occurred. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return null;

    return (
        <div className="relative min-h-screen flex" data-theme="light">
            {/* ─── Left: Video Background Panel ─── */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                >
                    <source src="/login-bg.mp4" type="video/mp4" />
                </video>
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/70 via-slate-900/60 to-cyan-900/50"></div>

                {/* Overlay content */}
                <div className="relative z-10 flex flex-col justify-between p-12">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="Verifair Logo" width={40} height={40} className="w-10 h-10" />
                        <span className="text-xl font-bold text-white tracking-tight">
                            Verifair
                        </span>
                    </div>

                    <div className="space-y-6 max-w-md">
                        <h2 className="text-4xl font-bold text-white leading-tight">
                            Detect Bias. <br />
                            <span className="text-cyan-300">Ensure Fairness.</span>
                        </h2>
                        <p className="text-white/70 text-lg leading-relaxed">
                            6 Analysis Modules, 473M+ parameters, and 9 peer-reviewed papers — working together to find what humans miss.
                        </p>

                        <div className="flex gap-4 pt-4">
                            {[
                                { label: "Neural Modules", value: "6" },
                                { label: "Parameters", value: "473M+" },
                                { label: "Bias Categories", value: "13" },
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10"
                                >
                                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                                    <p className="text-xs text-white/60">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-white/40 text-xs">
                        &copy; {new Date().getFullYear()} Verifair. All rights reserved.
                    </p>
                </div>
            </div>

            {/* ─── Right: Login Form ─── */}
            <div className="flex-1 flex items-center justify-center px-8 py-12 bg-gradient-to-br from-slate-50 to-indigo-50/30">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-4">
                        <Image src="/logo.svg" alt="Verifair Logo" width={40} height={40} className="w-10 h-10" />
                        <span className="text-xl font-bold text-slate-800 tracking-tight">
                            Veri<span className="text-indigo-600">fair</span>
                        </span>
                    </div>

                    {/* Header */}
                    <div className="text-center space-y-2">

                        <h1 className="text-3xl font-bold text-slate-900">
                            {isLogin ? "Welcome back" : "Create your account"}
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {isLogin
                                ? "Sign in to access your bias analysis dashboard"
                                : "Join Verifair to start detecting hidden bias"}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Your name"
                                        className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Enter your password"
                                    className="w-full pl-11 pr-12 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isLogin ? (
                                <>
                                    Sign In <ArrowRight className="w-4 h-4" />
                                </>
                            ) : (
                                <>
                                    Create Account <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <div className="text-center pt-2">
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError("");
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                        >
                            {isLogin
                                ? "Don't have an account? Sign up"
                                : "Already have an account? Sign in"}
                        </button>
                    </div>

                    {/* Back to landing */}
                    <div className="text-center">
                        <button
                            onClick={() => router.push("/landing")}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            &larr; Back to homepage
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
