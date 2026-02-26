"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { API } from "@/lib/api";
import axios from "axios";
import { Loader2, ArrowLeft, Camera, ShieldCheck, LogOut } from "lucide-react";

export default function ProfilePage() {
    const { user, loading, getToken, updateUser, logout } = useAuth();
    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/landing");
        }
        if (user) {
            setFullName(user.full_name || "");
            setProfilePicture(user.profile_picture_url || null);
        }
    }, [user, loading, router]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Ensure it's an image and not too massive
        if (!file.type.startsWith("image/")) {
            setMessage({ type: 'error', text: "Please upload a valid image file." });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: 'error', text: "Image is too large. Max size is 2MB." });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfilePicture(reader.result as string);
            setMessage(null);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        try {
            const token = getToken();
            const res = await axios.put(
                `${API}/auth/profile`,
                {
                    full_name: fullName,
                    profile_picture_url: profilePicture,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            updateUser(res.data);
            setMessage({ type: 'success', text: "Profile updated successfully." });
        } catch (err) {
            setMessage({ type: 'error', text: "Failed to update profile. Please try again." });
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
        );
    }

    return (
        <main className="min-h-screen font-sans" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

            {/* Header */}
            <nav className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: "var(--glass-bg)", borderBottom: "0.5px solid var(--border-primary)" }}>
                <div className="max-w-[800px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </button>
                    <span className="text-sm font-semibold tracking-tight">Your Profile</span>
                </div>
            </nav>

            <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-12">

                {/* Title */}
                <div className="mb-8 animate-fade-in-up">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Profile Settings</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Manage your account details and preferences.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Left Col - Avatar */}
                    <div className="md:col-span-1 flex flex-col items-center animate-fade-in-up delay-1">
                        <div
                            className="relative w-32 h-32 rounded-full overflow-hidden mb-4 group cursor-pointer border hover:border-[var(--accent)] transition-all"
                            style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {profilePicture ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-semibold text-white" style={{ background: "var(--accent)" }}>
                                    {(fullName || user.email)[0].toUpperCase()}
                                </div>
                            )}

                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />

                        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                            Click to upload new picture<br />(Max 2MB)
                        </p>
                    </div>

                    {/* Right Col - Form */}
                    <div className="md:col-span-2 animate-fade-in-up delay-2">
                        <div className="glass-card mb-6" style={{ background: "var(--bg-card)" }}>
                            <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">

                                {message && (
                                    <div className="p-4 rounded-xl text-sm font-medium flex items-center gap-2" style={{
                                        background: message.type === 'success' ? 'var(--status-success-soft)' : 'var(--status-danger-soft)',
                                        color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
                                    }}>
                                        {message.type === 'success' && <ShieldCheck className="w-4 h-4" />}
                                        {message.text}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border text-sm transition-all outline-none"
                                        style={{
                                            background: "var(--bg-input)",
                                            borderColor: "var(--border-primary)",
                                            color: "var(--text-primary)"
                                        }}
                                        placeholder="Alex Mercer"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={user.email}
                                        disabled
                                        className="w-full px-4 py-3 rounded-xl border text-sm opacity-60 cursor-not-allowed"
                                        style={{
                                            background: "var(--bg-input)",
                                            borderColor: "var(--border-primary)",
                                            color: "var(--text-primary)"
                                        }}
                                    />
                                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                                        Your email address is managed through your authentication provider and cannot be changed here.
                                    </p>
                                </div>

                                <div className="pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="apple-btn apple-btn-primary w-full sm:w-auto"
                                    >
                                        {isSaving ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...</>
                                        ) : (
                                            "Save Changes"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-8 border border-[#ff3b30]/20 rounded-2xl overflow-hidden bg-red-500/5">
                            <div className="p-6">
                                <h3 className="font-semibold text-[#ff3b30] mb-2">Danger Zone</h3>
                                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                                    You can instantly log out of your session on this device.
                                </p>
                                <button
                                    onClick={logout}
                                    className="apple-btn apple-btn-secondary text-[#ff3b30] hover:bg-[#ff3b30]/10 border border-[#ff3b30]/30"
                                >
                                    <LogOut className="w-4 h-4" /> Sign Out
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </main>
    );
}
