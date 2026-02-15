"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import {
    Shield,
    Sparkles,
    BarChart3,
    FileSearch,
    ArrowRight,
    ChevronDown,
    Brain,
    Zap,
    Lock,
    Users,
    Globe,
} from "lucide-react";

export default function LandingPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push("/dashboard");
        }
    }, [user, loading, router]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (loading) return null;

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-primary)" }} data-theme="light">
            {/* ─── Navbar ─── */}
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                    ? "bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm"
                    : "bg-transparent"
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-800 tracking-tight">
                            Veri<span className="text-indigo-600">fair</span>
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                        <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a>
                        <a href="#tech" className="hover:text-indigo-600 transition-colors">Technology</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/login")}
                            className="px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-indigo-700 transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => router.push("/login")}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── Hero Section ─── */}
            <section className="relative pt-32 pb-20 px-6 overflow-hidden">
                {/* Subtle gradient orbs */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-300/20 rounded-full blur-3xl"></div>
                <div className="absolute top-40 right-10 w-96 h-96 bg-cyan-300/15 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-rose-200/10 rounded-full blur-3xl"></div>

                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
                    {/* Left — Text */}
                    <div className="space-y-8">
                        <div className="animate-fade-in-up delay-1">
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-semibold">
                                <Sparkles className="w-4 h-4" />
                                AI-Powered Bias Detection
                            </span>
                        </div>

                        <h1 className="animate-fade-in-up delay-2 text-5xl lg:text-6xl font-bold text-slate-900 leading-tight tracking-tight">
                            Fairness You Can{" "}
                            <span className="gradient-text">Verify.</span>
                        </h1>

                        <p className="animate-fade-in-up delay-3 text-lg text-slate-600 max-w-xl leading-relaxed">
                            Verifair scans documents and text for hidden biases using <strong>6 research-backed AI engines</strong>,
                            covering hate speech, stereotypes, and differential treatment — then explains findings in plain English.
                        </p>

                        <div className="animate-fade-in-up delay-4 flex flex-wrap gap-4">
                            <button
                                onClick={() => router.push("/login")}
                                className="group px-7 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 flex items-center gap-2"
                            >
                                Start Analyzing
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <a
                                href="#features"
                                className="px-7 py-3.5 text-base font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-sm"
                            >
                                Learn More
                            </a>
                        </div>

                        {/* Trust indicators */}
                        <div className="animate-fade-in-up delay-5 flex items-center gap-6 pt-4 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-emerald-500" />
                                <span>100% Local Processing</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4 text-indigo-500" />
                                <span>473M+ AI Parameters</span>
                            </div>
                        </div>
                    </div>

                    {/* Right — Hero Image */}
                    <div className="animate-scale-in delay-3 relative">
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-slate-300/50 border border-slate-200/60">
                            <Image
                                src="/landing-hero.jpg"
                                alt="Verifair AI Bias Detection - Understanding cognitive biases"
                                width={800}
                                height={450}
                                className="w-full h-auto animate-float"
                                style={{ animationDuration: "8s" }}
                                priority
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent"></div>
                        </div>
                        {/* Floating stat badges */}
                        <div className="absolute -bottom-4 -left-4 px-5 py-3 bg-white rounded-2xl border border-slate-200 shadow-xl animate-float" style={{ animationDelay: "1s" }}>
                            <p className="text-xs text-slate-500 font-medium">Analysis Engine</p>
                            <p className="text-lg font-bold text-indigo-700">6 Layers</p>
                        </div>
                        <div className="absolute -top-4 -right-4 px-5 py-3 bg-white rounded-2xl border border-slate-200 shadow-xl animate-float" style={{ animationDelay: "2s" }}>
                            <p className="text-xs text-slate-500 font-medium">Stereotype Categories</p>
                            <p className="text-lg font-bold text-rose-600">13 Tracked</p>
                        </div>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="flex justify-center mt-16">
                    <a href="#features" className="animate-bounce text-slate-400 hover:text-indigo-500 transition-colors">
                        <ChevronDown className="w-6 h-6" />
                    </a>
                </div>
            </section>

            {/* ─── Features Section ─── */}
            <section id="features" className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">
                            Six Engines, One Mission
                        </h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                            Every analysis is powered by peer-reviewed research from ACL, NAACL, and Science.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: <BarChart3 className="w-6 h-6" />,
                                color: "from-indigo-500 to-indigo-600",
                                badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
                                title: "Z-Score Bias Detection",
                                desc: "Statistically measures disproportionate associations between text and identity groups using cosine similarity and Z-score normalization.",
                            },
                            {
                                icon: <Zap className="w-6 h-6" />,
                                color: "from-violet-500 to-purple-600",
                                badge: "bg-violet-50 text-violet-700 border-violet-100",
                                title: "WEAT / SEAT Analysis",
                                desc: "Measures differential associations between text and pleasant vs. unpleasant attributes, with statistical significance testing.",
                            },
                            {
                                icon: <Users className="w-6 h-6" />,
                                color: "from-rose-500 to-pink-600",
                                badge: "bg-rose-50 text-rose-700 border-rose-100",
                                title: "Stereotype Detection",
                                desc: "Scans 13 stereotype categories including gender, race, age, religion, disability, and intersectional bias with severity scoring.",
                            },
                            {
                                icon: <Shield className="w-6 h-6" />,
                                color: "from-red-500 to-red-600",
                                badge: "bg-red-50 text-red-700 border-red-100",
                                title: "Hate Speech (3-Layer)",
                                desc: "Ensemble of Dynabench RoBERTa, Microsoft ToxiGen, and curated lexicon catches explicit, implicit, and coded hate language.",
                            },
                            {
                                icon: <FileSearch className="w-6 h-6" />,
                                color: "from-cyan-500 to-teal-600",
                                badge: "bg-cyan-50 text-cyan-700 border-cyan-100",
                                title: "Advice Disparity",
                                desc: "Detects when text gives different quality of advice or recommendations based on the mentioned identity groups.",
                            },
                            {
                                icon: <Globe className="w-6 h-6" />,
                                color: "from-amber-500 to-orange-600",
                                badge: "bg-amber-50 text-amber-700 border-amber-100",
                                title: "Quality & Vagueness",
                                desc: "Flags subjective, vague feedback like 'culture fit' or 'just a feeling' that are often proxies for coded bias.",
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="group p-7 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1"
                            >
                                <div
                                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform`}
                                >
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── How It Works ─── */}
            <section id="how-it-works" className="py-24 px-6" style={{ background: "#f8fbfd" }}>
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
                        <p className="text-lg text-slate-500">Three steps to uncover hidden bias</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: "01",
                                title: "Upload",
                                desc: "Drop PDFs, CSVs, or paste text directly. Batch analysis supports up to 50 items.",
                                color: "text-indigo-600",
                                bg: "bg-indigo-50",
                            },
                            {
                                step: "02",
                                title: "Analyze",
                                desc: "Our 6-engine pipeline processes every sentence with 4 neural models and statistical tests.",
                                color: "text-violet-600",
                                bg: "bg-violet-50",
                            },
                            {
                                step: "03",
                                title: "Understand",
                                desc: "Interactive dashboards with charts, severity scores, and AI-generated plain English explanations.",
                                color: "text-cyan-600",
                                bg: "bg-cyan-50",
                            },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-4">
                                <div className={`inline-flex w-16 h-16 rounded-2xl ${item.bg} items-center justify-center`}>
                                    <span className={`text-2xl font-bold ${item.color}`}>{item.step}</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Tech Stack Highlight ─── */}
            <section id="tech" className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">Built With Research-Grade AI</h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                            473 million+ model parameters, 9 peer-reviewed papers, zero cloud dependencies.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { name: "all-mpnet-base-v2", label: "Embeddings", params: "110M" },
                            { name: "toxic-bert", label: "Toxicity", params: "110M" },
                            { name: "Dynabench RoBERTa", label: "Hate Speech", params: "125M" },
                            { name: "ToxiGen RoBERTa", label: "Implicit Hate", params: "125M" },
                            { name: "Llama 3.2", label: "Explanations", params: "3B" },
                            { name: "FastAPI", label: "Backend", params: "Python" },
                            { name: "Next.js 16", label: "Frontend", params: "React" },
                            { name: "Fairlearn", label: "Fairness Metrics", params: "Microsoft" },
                        ].map((tech, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-center"
                            >
                                <p className="text-sm font-bold text-slate-800">{tech.name}</p>
                                <p className="text-xs text-slate-500 mt-1">{tech.label}</p>
                                <span className="inline-block mt-2 text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                    {tech.params}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA Section ─── */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto text-center space-y-8">
                    <h2 className="text-4xl font-bold text-slate-900">
                        Ready to Audit Your Data?
                    </h2>
                    <p className="text-lg text-slate-500">
                        Start detecting hidden biases in your documents today. No cloud APIs, no data leaves your machine.
                    </p>
                    <button
                        onClick={() => router.push("/login")}
                        className="group px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 inline-flex items-center gap-3"
                    >
                        Get Started Free
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="py-10 px-6 border-t border-slate-200">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-slate-700">Verifair</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-mono">
                            v3.1.0
                        </span>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Verifair. AI-Powered Bias Detection.</p>
                    <a
                        href="https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-600 transition-colors"
                    >
                        GitHub
                    </a>
                </div>
            </footer>
        </div>
    );
}
