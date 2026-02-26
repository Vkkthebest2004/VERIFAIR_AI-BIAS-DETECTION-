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
            {/* ─── Left: Video Panel ─── */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                >
                    <source src="/login-bg.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/50"></div>

                <div className="relative z-10 flex flex-col justify-between p-10 sm:p-12">
                    <div className="flex items-center gap-2.5">
                        <Image src="/logo.svg" alt="Verifair" width={32} height={32} className="w-8 h-8" />
                        <span className="text-base font-semibold text-white/90 tracking-tight">
                            Verifair
                        </span>
                    </div>

                    <div className="space-y-5 max-w-md">
                        <h2 className="text-[40px] font-semibold text-white leading-[1.1] tracking-[-0.03em]">
                            Detect Bias.<br />
                            <span className="text-[#64d2ff]">Ensure Fairness.</span>
                        </h2>
                        <p className="text-white/60 text-base leading-relaxed">
                            6 Analysis Modules, 473M+ parameters, and 9 peer-reviewed papers — working together to find what humans miss.
                        </p>

                        <div className="flex gap-3 pt-2">
                            {[
                                { label: "Neural Modules", value: "6" },
                                { label: "Parameters", value: "473M+" },
                                { label: "Bias Categories", value: "13" },
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className="px-4 py-3 rounded-2xl bg-[var(--bg-card)]/[0.08] backdrop-blur-sm border border-white/[0.08]"
                                >
                                    <p className="text-xl font-semibold text-white">{stat.value}</p>
                                    <p className="text-[11px] text-white/50">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-white/30 text-xs">
                        &copy; {new Date().getFullYear()} Verifair. All rights reserved.
                    </p>
                </div>
            </div>

            {/* ─── Right: Form ─── */}
            <div className="flex-1 flex items-center justify-center px-6 sm:px-8 py-12 bg-[var(--bg-card)]">
                <div className="w-full max-w-[400px] space-y-8">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center justify-center gap-2.5 mb-4">
                        <Image src="/logo.svg" alt="Verifair" width={32} height={32} className="w-8 h-8" />
                        <span className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                            Verifair
                        </span>
                    </div>

                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h1 className="text-[28px] font-semibold text-[var(--text-primary)] tracking-[-0.03em]">
                            {isLogin ? "Welcome back" : "Create your account"}
                        </h1>
                        <p className="text-[var(--text-secondary)] text-sm">
                            {isLogin
                                ? "Sign in to access your bias analysis dashboard"
                                : "Join Verifair to start detecting hidden bias"}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-[var(--text-primary)]">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                    <input
                                        type="text"
                                        placeholder="Your name"
                                        className="w-full pl-10 pr-4 py-3 text-sm bg-[var(--bg-secondary)] border border-[#d2d2d7] rounded-xl text-[var(--text-primary)] placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] outline-none transition-all"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-[var(--text-primary)]">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    className="w-full pl-10 pr-4 py-3 text-sm bg-[var(--bg-secondary)] border border-[#d2d2d7] rounded-xl text-[var(--text-primary)] placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] outline-none transition-all"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-[var(--text-primary)]">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Enter your password"
                                    className="w-full pl-10 pr-12 py-3 text-sm bg-[var(--bg-secondary)] border border-[#d2d2d7] rounded-xl text-[var(--text-primary)] placeholder:text-[#aeaeb2] focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] outline-none transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
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
                            <div className="p-3 rounded-xl bg-[#ff3b30]/[0.06] border border-[#ff3b30]/10 text-[#ff3b30] text-sm text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 text-sm font-medium text-white bg-[#0071e3] rounded-xl hover:bg-[#0077ed] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                            className="text-sm text-[#0071e3] hover:underline font-medium transition-colors"
                        >
                            {isLogin
                                ? "Don't have an account? Sign up"
                                : "Already have an account? Sign in"}
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            onClick={() => router.push("/landing")}
                            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            &larr; Back to homepage
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
