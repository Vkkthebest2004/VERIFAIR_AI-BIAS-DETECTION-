"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import {
    Shield,
    BarChart3,
    ArrowRight,
    ChevronDown,
    Brain,
    Zap,
    Lock,
    Users,
    Globe,
    FileSearch,
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

    const features = [
        {
            icon: <BarChart3 className="w-6 h-6" />,
            color: "#0071e3",
            title: "Z-Score Bias Detection",
            desc: "Statistically measures disproportionate associations between text and identity groups using cosine similarity.",
        },
        {
            icon: <Zap className="w-6 h-6" />,
            color: "#af52de",
            title: "WEAT / SEAT Analysis",
            desc: "Measures differential associations between text and pleasant vs. unpleasant attributes with statistical testing.",
        },
        {
            icon: <Users className="w-6 h-6" />,
            color: "#ff3b30",
            title: "Stereotype Detection",
            desc: "Scans 13 stereotype categories including gender, race, age, religion, disability, and intersectional bias.",
        },
        {
            icon: <Shield className="w-6 h-6" />,
            color: "#ff9500",
            title: "Hate Speech (3-Layer)",
            desc: "Ensemble of Dynabench RoBERTa, Microsoft ToxiGen, and curated lexicon catches explicit and implicit hate.",
        },
        {
            icon: <FileSearch className="w-6 h-6" />,
            color: "#32ade6",
            title: "Advice Disparity",
            desc: "Detects when text gives different quality of advice or recommendations based on identity groups.",
        },
        {
            icon: <Globe className="w-6 h-6" />,
            color: "#34c759",
            title: "Quality & Vagueness",
            desc: "Flags subjective, vague feedback like 'culture fit' that are often proxies for coded bias.",
        },
    ];

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-primary)" }} data-theme="light">
            {/* ─── Navbar ─── */}
            <nav
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                    ? "backdrop-blur-xl shadow-sm"
                    : ""
                    }`}
                style={{
                    background: scrolled ? "rgba(255,255,255,0.72)" : "transparent",
                    borderBottom: scrolled ? "0.5px solid rgba(0,0,0,0.1)" : "none",
                }}
            >
                <div className="max-w-[980px] mx-auto px-6 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Image src="/logo.svg" alt="Verifair" width={28} height={28} className="w-7 h-7" />
                        <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                            Verifair
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-7 text-xs font-medium text-[var(--text-secondary)]">
                        <a href="#features" className="hover:text-[var(--text-primary)] transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-[var(--text-primary)] transition-colors">How It Works</a>
                        <a href="#tech" className="hover:text-[var(--text-primary)] transition-colors">Technology</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/login")}
                            className="text-xs font-medium text-[#0071e3] hover:underline transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => router.push("/login")}
                            className="px-4 py-1.5 text-xs font-medium text-white bg-[#0071e3] rounded-full hover:bg-[#0077ed] transition-all active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── Hero Section ─── */}
            <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 px-6 overflow-hidden">
                <div className="max-w-[980px] mx-auto text-center relative z-10">
                    <div className="animate-fade-in-up delay-1">
                        <p className="text-sm sm:text-base font-medium text-[#0071e3] mb-4">
                            Bias Audit Engine
                        </p>
                    </div>

                    <h1 className="animate-fade-in-up delay-2 text-[40px] sm:text-[56px] lg:text-[64px] font-semibold text-[var(--text-primary)] leading-[1.05] tracking-[-0.03em] mb-4">
                        Fairness you can<br />
                        <span className="gradient-text">verify.</span>
                    </h1>

                    <p className="animate-fade-in-up delay-3 text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed mb-8">
                        6 research-backed analysis modules scan every sentence for hidden bias —
                        hate speech, stereotypes, and differential treatment — then explain findings in plain English.
                    </p>

                    <div className="animate-fade-in-up delay-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={() => router.push("/login")}
                            className="group px-7 py-3 text-base font-medium text-white bg-[#0071e3] rounded-full hover:bg-[#0077ed] transition-all active:scale-95 inline-flex items-center gap-2"
                        >
                            Start Analyzing
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <a
                            href="#features"
                            className="px-7 py-3 text-base font-medium text-[#0071e3] hover:underline transition-all"
                        >
                            Learn more ›
                        </a>
                    </div>

                    {/* Trust Indicators */}
                    <div className="animate-fade-in-up delay-5 flex flex-wrap items-center justify-center gap-6 pt-10 text-sm text-[var(--text-muted)]">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-[#34c759]" />
                            <span>100% Local Processing</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-[#0071e3]" />
                            <span>473M+ Parameters</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-[#af52de]" />
                            <span>9 Peer-Reviewed Papers</span>
                        </div>
                    </div>
                </div>

                {/* Hero Image */}
                <div className="animate-scale-in delay-3 max-w-[980px] mx-auto mt-12 sm:mt-16 relative">
                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/10">
                        <Image
                            src="/landing-hero.jpg"
                            alt="Verifair Bias Audit"
                            width={980}
                            height={551}
                            className="w-full h-auto"
                            priority
                        />
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="flex justify-center mt-12 sm:mt-16">
                    <a href="#features" className="animate-bounce text-[var(--text-muted)] hover:text-[#0071e3] transition-colors">
                        <ChevronDown className="w-5 h-5" />
                    </a>
                </div>
            </section>

            {/* ─── Features Section ─── */}
            <section id="features" className="py-16 sm:py-24 px-6" style={{ background: "var(--bg-secondary)" }}>
                <div className="max-w-[980px] mx-auto">
                    <div className="text-center mb-12 sm:mb-16">
                        <h2 className="text-[32px] sm:text-[40px] font-semibold text-[var(--text-primary)] mb-3 tracking-[-0.03em]">
                            Six engines. One mission.
                        </h2>
                        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                            Every analysis is powered by peer-reviewed research from ACL, NAACL, and Science.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((feature, i) => (
                            <div
                                key={i}
                                className="group p-6 rounded-2xl bg-[var(--bg-card)] transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.04] hover:-translate-y-1"
                            >
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                                    style={{ background: `${feature.color}12`, color: feature.color }}
                                >
                                    {feature.icon}
                                </div>
                                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── How It Works ─── */}
            <section id="how-it-works" className="py-16 sm:py-24 px-6 bg-[var(--bg-card)]">
                <div className="max-w-[980px] mx-auto">
                    <div className="text-center mb-12 sm:mb-16">
                        <h2 className="text-[32px] sm:text-[40px] font-semibold text-[var(--text-primary)] mb-3 tracking-[-0.03em]">
                            How it works.
                        </h2>
                        <p className="text-lg text-[var(--text-secondary)]">Three steps to uncover hidden bias.</p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
                        {[
                            {
                                step: "01",
                                title: "Upload",
                                desc: "Drop PDFs, CSVs, or paste text directly. Batch analysis supports up to 50 items.",
                                color: "#0071e3",
                            },
                            {
                                step: "02",
                                title: "Analyze",
                                desc: "Our 6-stage pipeline processes every sentence with 4 neural models and statistical tests.",
                                color: "#af52de",
                            },
                            {
                                step: "03",
                                title: "Understand",
                                desc: "Interactive dashboards with charts, severity scores, and Generative Contextual Explanations.",
                                color: "#32ade6",
                            },
                        ].map((item, i) => (
                            <div key={i} className="text-center space-y-4">
                                <div
                                    className="inline-flex w-14 h-14 rounded-2xl items-center justify-center"
                                    style={{ background: `${item.color}0F` }}
                                >
                                    <span className="text-xl font-bold" style={{ color: item.color }}>{item.step}</span>
                                </div>
                                <h3 className="text-xl font-semibold text-[var(--text-primary)]">{item.title}</h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Tech Stack ─── */}
            <section id="tech" className="py-16 sm:py-24 px-6" style={{ background: "var(--bg-secondary)" }}>
                <div className="max-w-[980px] mx-auto">
                    <div className="text-center mb-12 sm:mb-16">
                        <h2 className="text-[32px] sm:text-[40px] font-semibold text-[var(--text-primary)] mb-3 tracking-[-0.03em]">
                            Built with state-of-the-art NLP.
                        </h2>
                        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                            473 million+ model parameters. Zero cloud dependencies.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { name: "all-mpnet-base-v2", label: "Embeddings", params: "110M" },
                            { name: "toxic-bert", label: "Toxicity", params: "110M" },
                            { name: "Dynabench RoBERTa", label: "Hate Speech", params: "125M" },
                            { name: "ToxiGen RoBERTa", label: "Implicit Hate", params: "125M" },
                            { name: "Llama 3.2", label: "Context", params: "3B" },
                            { name: "FastAPI", label: "Backend", params: "Python" },
                            { name: "Next.js 16", label: "Frontend", params: "React" },
                            { name: "Fairlearn", label: "Metrics", params: "Microsoft" },
                        ].map((tech, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-2xl bg-[var(--bg-card)] hover:shadow-lg hover:shadow-black/[0.03] transition-all text-center group"
                            >
                                <p className="text-sm font-semibold text-[var(--text-primary)]">{tech.name}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">{tech.label}</p>
                                <span className="inline-block mt-2 text-[10px] font-mono text-[#0071e3] bg-[#0071e3]/[0.06] px-2.5 py-0.5 rounded-full">
                                    {tech.params}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA Section ─── */}
            <section className="py-16 sm:py-24 px-6 bg-[var(--bg-card)]">
                <div className="max-w-[580px] mx-auto text-center space-y-6">
                    <h2 className="text-[32px] sm:text-[40px] font-semibold text-[var(--text-primary)] tracking-[-0.03em]">
                        Ready to audit your data?
                    </h2>
                    <p className="text-lg text-[var(--text-secondary)]">
                        Start detecting hidden biases today. No cloud APIs, no data leaves your machine.
                    </p>
                    <button
                        onClick={() => router.push("/login")}
                        className="group px-8 py-3.5 text-base font-medium text-white bg-[#0071e3] rounded-full hover:bg-[#0077ed] transition-all active:scale-95 inline-flex items-center gap-2.5"
                    >
                        Get Started Free
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="py-8 px-6" style={{ background: "var(--bg-secondary)" }}>
                <div className="max-w-[980px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="Verifair" width={20} height={20} className="w-5 h-5" />
                        <span className="font-semibold text-[var(--text-primary)]">Verifair</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#0071e3]/[0.06] text-[#0071e3] text-[10px] font-mono">
                            v3.6.0
                        </span>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Verifair. Bias Audit System.</p>
                    <a
                        href="https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#0071e3] transition-colors"
                    >
                        GitHub
                    </a>
                </div>
            </footer>
        </div>
    );
}
