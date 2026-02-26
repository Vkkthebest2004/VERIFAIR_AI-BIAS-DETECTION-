'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Mic, Square, Loader2, AlertCircle, ShieldAlert, CheckCircle2,
    Brain, Zap, Radio, Shield, Users, Volume2,
    ChevronDown, Eye, Sparkles, BarChart3, FileText, X, Download,
    Search, Building2, Target, ClipboardList
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

// ── Types ──

interface BiasFlag {
    type: string;
    severity: string;
    group: string;
    matched_text: string[];
    note?: string;
}

interface Tier1Result {
    tier: number;
    is_biased: boolean;
    severity: string;
    flags: BiasFlag[];
    flag_count: number;
}

interface Tier2Result {
    tier: number;
    is_biased?: boolean;
    severity?: string;
    bias_type?: string;
    affected_groups?: string[];
    explanation?: string;
    suggestion?: string;
    confidence?: number;
    model_used?: string;
    error?: string;
}

interface SpeakerRole {
    role: string;
    confidence: number;
    indicators: string[];
}

interface AnalysisEntry {
    id: string;
    text: string;
    speaker?: string;
    speaker_role?: SpeakerRole;
    tier1: Tier1Result;
    tier2?: Tier2Result;
    is_biased: boolean;
    severity: string;
    timestamp: string;
    has_deep_analysis: boolean;
}

// ── Severity Colors ──
const severityColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    critical: { bg: 'bg-red-900/30', text: 'text-red-200', border: 'border-red-500/50', glow: 'shadow-red-500/20' },
    high: { bg: 'bg-orange-900/30', text: 'text-orange-200', border: 'border-orange-500/50', glow: 'shadow-orange-500/20' },
    medium: { bg: 'bg-amber-900/30', text: 'text-amber-200', border: 'border-amber-500/50', glow: 'shadow-amber-500/20' },
    low: { bg: 'bg-yellow-900/20', text: 'text-yellow-200', border: 'border-yellow-600/40', glow: 'shadow-yellow-500/10' },
    none: { bg: 'bg-emerald-900/20', text: 'text-emerald-200', border: 'border-emerald-600/30', glow: 'shadow-emerald-500/10' },
};

interface SpeechReport {
    overall_score: number;
    summary: string;
    primary_bias_patterns: string[];
    speaker_dynamics: string;
    key_suggestions: string[];
    model_used?: string;
}

export default function LiveCopilotPage() {
    // ── State ──
    const [isListening, setIsListening] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [entries, setEntries] = useState<AnalysisEntry[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [scenario, setScenario] = useState('general');
    const [, setSessionId] = useState('');
    const [bertAvailable, setBertAvailable] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showScenarioSelect, setShowScenarioSelect] = useState(false);
    const [duration, setDuration] = useState(0);

    // ── Report State ──
    const [report, setReport] = useState<SpeechReport | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    const { user, loading } = useAuth();
    const router = useRouter();

    // ── Refs ──
    const webSocketRef = useRef<WebSocket | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);
    const feedRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Check Web Speech API Support ──
    const speechSupported = useMemo(() => {
        if (typeof window === 'undefined') return true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return !!((window as unknown as Record<string, any>).SpeechRecognition || (window as unknown as Record<string, any>).webkitSpeechRecognition);
    }, []);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [loading, user, router]);

    // ── Auto-scroll feed ──
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = 0; // newest at top
        }
    }, [entries]);

    // ── Cleanup on unmount ──
    const stopEverything = useCallback(() => {
        setIsListening(false);
        setCurrentTranscript('');
        setIsProcessing(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
            recognitionRef.current = null;
        }

        if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            webSocketRef.current.close();
        }

        setConnectionStatus('disconnected');
    }, []);

    useEffect(() => {
        return () => stopEverything();
    }, [stopEverything]);

    // ── Connect WebSocket + Start Speech Recognition ──
    const startCopilot = () => {
        if (!speechSupported) return;

        setEntries([]);
        setErrorMessage('');
        setDuration(0);
        setConnectionStatus('connecting');

        // Build WebSocket URL
        const wsUrl = API_BASE_URL
            ? `${API_BASE_URL.replace('http', 'ws')}/api/v1/ws/live-copilot`
            : `ws://localhost:8000/api/v1/ws/live-copilot`;

        try {
            const ws = new WebSocket(wsUrl);
            webSocketRef.current = ws;

            ws.onopen = () => {
                // Wait for the server's connection confirmation
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'connected') {
                        setConnectionStatus('connected');
                        setSessionId(data.session_id);
                        setBertAvailable(data.bert_available ?? data.llm_available ?? false);
                        startSpeechRecognition();

                        // Start timer
                        timerRef.current = setInterval(() => {
                            setDuration(prev => prev + 1);
                        }, 1000);
                    }

                    if (data.type === 'analysis') {
                        setIsProcessing(false);
                        const entry: AnalysisEntry = {
                            id: Math.random().toString(36).substring(7),
                            text: data.text,
                            speaker: data.speaker,
                            speaker_role: data.speaker_role,
                            tier1: data.tier1,
                            tier2: undefined,
                            is_biased: data.is_biased,
                            severity: data.severity,
                            timestamp: new Date().toLocaleTimeString(),
                            has_deep_analysis: false,
                        };
                        setEntries(prev => [entry, ...prev]);
                    }

                    if (data.type === 'deep_analysis') {
                        // Update the matching entry with Tier 2 results
                        setEntries(prev =>
                            prev.map(entry => {
                                if (entry.text === data.text && !entry.has_deep_analysis) {
                                    return {
                                        ...entry,
                                        tier2: data.tier2,
                                        has_deep_analysis: true,
                                        // Update severity if Tier 2 found something worse
                                        severity: data.tier2?.severity &&
                                            getSeverityLevel(data.tier2.severity) > getSeverityLevel(entry.severity)
                                            ? data.tier2.severity
                                            : entry.severity,
                                    };
                                }
                                return entry;
                            })
                        );
                    }

                    if (data.type === 'silence') {
                        // Optionally show a subtle indicator
                    }

                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onerror = () => {
                setConnectionStatus('error');
                setErrorMessage('Failed to connect. Make sure the backend is running.');
                stopEverything();
            };

            ws.onclose = () => {
                if (connectionStatus !== 'error') {
                    setConnectionStatus('disconnected');
                }
            };

        } catch {
            setConnectionStatus('error');
            setErrorMessage('Could not establish connection.');
        }
    };

    // ── Web Speech API — Browser-Native Speech Recognition ──
    const startSpeechRecognition = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognitionCtor = (window as unknown as Record<string, any>).SpeechRecognition || (window as unknown as Record<string, any>).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) return;

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Show interim results as live typing indicator
            setCurrentTranscript(interimTranscript || finalTranscript);

            // When a final result is received, send it to the backend
            if (finalTranscript.trim()) {
                setCurrentTranscript('');
                setIsProcessing(true);
                sendTextForAnalysis(finalTranscript.trim());
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setErrorMessage('Microphone access denied. Please allow microphone access.');
                stopEverything();
            }
            // For 'no-speech' errors, just restart
            if (event.error === 'no-speech' || event.error === 'aborted') {
                // Try to restart
                try {
                    setTimeout(() => {
                        if (isListening && recognitionRef.current) {
                            recognitionRef.current.start();
                        }
                    }, 200);
                } catch { /* ignore */ }
            }
        };

        recognition.onend = () => {
            // Auto-restart if still supposed to be listening
            if (isListening && webSocketRef.current?.readyState === WebSocket.OPEN) {
                try {
                    recognition.start();
                } catch { /* ignore */ }
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    // ── Send TEXT to Backend WebSocket ──
    const sendTextForAnalysis = (text: string) => {
        if (webSocketRef.current?.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify({
                text,
                scenario,
                speaker: 'Speaker 1',
            }));
        }
    };

    // ── Generate End of Session Report ──
    const generateReport = async () => {
        if (entries.length === 0) return;

        stopEverything();
        setIsGeneratingReport(true);
        setErrorMessage('');

        try {
            const res = await fetch(`${API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : 'http://localhost:8000'}/api/v1/copilot/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_entries: entries, scenario }),
            });

            if (!res.ok) throw new Error('Failed to generate report');

            const data = await res.json();
            setReport(data);
            setShowReportModal(true);
        } catch (err) {
            setErrorMessage('Failed to generate speech bias report. Please check if the backend is running.');
            console.error(err);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // ── Helpers ──
    const getSeverityLevel = (severity: string): number => {
        const levels: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
        return levels[severity] || 0;
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const biasCount = entries.filter(e => e.is_biased).length;
    const cleanCount = entries.filter(e => !e.is_biased).length;
    const criticalCount = entries.filter(e => e.severity === 'critical' || e.severity === 'high').length;

    const scenarioLabels: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
        general: { label: 'General', icon: <Search className="w-4 h-4 text-violet-400" />, desc: 'Detect all types of bias' },
        meeting: { label: 'Meeting', icon: <Building2 className="w-4 h-4 text-cyan-400" />, desc: 'Idea theft, silencing, dynamics' },
        interview: { label: 'Interview', icon: <Target className="w-4 h-4 text-amber-400" />, desc: 'Hiring bias, illegal questions' },
        hr_review: { label: 'HR Review', icon: <ClipboardList className="w-4 h-4 text-emerald-400" />, desc: 'Gendered language, vague feedback' },
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white">
            {/* ── Background Effects ── */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                {isListening && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/3 rounded-full blur-3xl animate-pulse" />
                )}
            </div>

            <div className="relative container mx-auto py-6 px-4 max-w-7xl">
                {/* ── Header ── */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                                <Brain className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
                                Live Copilot
                            </h1>
                            {isListening && (
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium">
                                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                    LIVE
                                </span>
                            )}
                        </div>
                        <p className="text-[var(--text-muted)] text-sm">
                            Real-time speech analysis powered by Web Speech API + AI bias detection engine
                        </p>
                    </div>

                    {/* Scenario Selector */}
                    <div className="relative z-50">
                        <button
                            onClick={() => setShowScenarioSelect(!showScenarioSelect)}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)]/50 hover:bg-slate-700/50 border border-white/10 transition-all text-sm font-medium shadow-sm"
                            disabled={isListening}
                        >
                            <span className="flex items-center gap-2">
                                <span className="p-1 rounded-md bg-[var(--bg-card)]/5">
                                    {scenarioLabels[scenario]?.icon}
                                </span>
                                {scenarioLabels[scenario]?.label}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showScenarioSelect ? 'rotate-180' : ''}`} />
                        </button>

                        {showScenarioSelect && !isListening && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-primary)] border border-white/10 rounded-xl shadow-xl overflow-hidden origin-top-right animate-in fade-in scale-95 duration-100">
                                <div className="p-1.5">
                                    {Object.entries(scenarioLabels).map(([key, val]) => (
                                        <button
                                            key={key}
                                            onClick={() => { setScenario(key); setShowScenarioSelect(false); }}
                                            className={`w-full px-3 py-2.5 flex items-start gap-3 rounded-lg hover:bg-[var(--bg-card)]/5 transition-colors text-left ${scenario === key ? 'bg-violet-500/10 text-white' : 'text-[var(--text-faint)]'}`}
                                        >
                                            <span className={`mt-0.5 p-1 rounded-md ${scenario === key ? 'bg-violet-500/20' : 'bg-[var(--bg-card)]/5'}`}>
                                                {val.icon}
                                            </span>
                                            <div>
                                                <p className={`font-medium text-sm ${scenario === key ? 'text-violet-300' : 'text-slate-200'}`}>{val.label}</p>
                                                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{val.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* ═══════════════════════════════════════════════════════════
                        LEFT PANEL — Controls + Stats
                    ═══════════════════════════════════════════════════════════ */}
                    <div className="lg:col-span-4 space-y-5">

                        {/* Microphone Control Card */}
                        <div className="rounded-2xl bg-[var(--bg-card)]/[0.03] backdrop-blur-sm border border-white/[0.06] p-6">
                            <div className="flex items-center gap-2 mb-5">
                                <Radio className="w-4 h-4 text-violet-400" />
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-faint)]">Voice Capture</h3>
                            </div>

                            {/* Error Banner */}
                            {errorMessage && (
                                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <p>{errorMessage}</p>
                                </div>
                            )}

                            {/* Speech Not Supported Banner */}
                            {!speechSupported && (
                                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                                    <p className="font-medium mb-1">Browser Not Supported</p>
                                    <p className="text-xs text-amber-300/70">
                                        Web Speech API requires Chrome, Edge, or Safari. Firefox is not supported.
                                    </p>
                                </div>
                            )}

                            {/* Big Mic Button */}
                            <div className="flex flex-col items-center gap-4">
                                {/* Timer */}
                                {(isListening || duration > 0) && (
                                    <div className="text-center">
                                        <p className="text-4xl font-mono font-bold text-white tracking-wider">
                                            {formatDuration(duration)}
                                        </p>
                                    </div>
                                )}

                                {/* Mic Button */}
                                {!isListening ? (
                                    <button
                                        onClick={startCopilot}
                                        disabled={connectionStatus === 'connecting' || !speechSupported}
                                        className="group w-28 h-28 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {connectionStatus === 'connecting' ? (
                                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                                        ) : (
                                            <Mic className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopEverything}
                                        className="group w-28 h-28 rounded-full bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center shadow-xl shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 hover:scale-105 animate-pulse"
                                    >
                                        <Square className="w-10 h-10 text-white" />
                                    </button>
                                )}

                                <p className="text-xs text-[var(--text-secondary)] text-center">
                                    {!isListening
                                        ? 'Click to start real-time bias detection'
                                        : 'Listening... speak naturally'}
                                </p>

                                {/* Live Transcript Preview */}
                                {(currentTranscript || isProcessing) && (
                                    <div className="w-full p-3 rounded-xl bg-[var(--bg-card)]/[0.03] border border-white/[0.06]">
                                        {currentTranscript && (
                                            <p className="text-sm text-[var(--text-faint)] italic">
                                                <Volume2 className="w-3 h-3 inline mr-1 text-violet-400" />
                                                &quot;{currentTranscript}&quot;
                                            </p>
                                        )}
                                        {isProcessing && (
                                            <div className="flex items-center gap-2 text-xs text-violet-400 mt-1">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Analyzing...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Connection Status */}
                            <div className="mt-5 pt-4 border-t border-white/[0.06] flex justify-between items-center text-xs">
                                <span className="text-[var(--text-secondary)]">Status</span>
                                <span className={`font-medium flex items-center gap-1.5 ${connectionStatus === 'connected' ? 'text-emerald-400' :
                                    connectionStatus === 'error' ? 'text-red-400' :
                                        connectionStatus === 'connecting' ? 'text-amber-400' : 'text-[var(--text-secondary)]'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' :
                                        connectionStatus === 'error' ? 'bg-red-400' :
                                            connectionStatus === 'connecting' ? 'bg-amber-400' : 'bg-slate-600'}`} />
                                    {connectionStatus === 'connected' && 'Live & Listening'}
                                    {connectionStatus === 'connecting' && 'Connecting...'}
                                    {connectionStatus === 'error' && 'Connection Failed'}
                                    {connectionStatus === 'disconnected' && 'Standby'}
                                </span>
                            </div>
                        </div>

                        {/* Live Stats Card */}
                        {entries.length > 0 && (
                            <div className="rounded-2xl bg-[var(--bg-card)]/[0.03] backdrop-blur-sm border border-white/[0.06] p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                                    <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-faint)]">Live Stats</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 text-center">
                                        <p className="text-2xl font-bold text-white">{entries.length}</p>
                                        <p className="text-[10px] uppercase text-[var(--text-secondary)] tracking-wider mt-1">Analyzed</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-red-900/20 border border-red-500/10 text-center">
                                        <p className="text-2xl font-bold text-red-400">{biasCount}</p>
                                        <p className="text-[10px] uppercase text-red-400/60 tracking-wider mt-1">Flagged</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/10 text-center">
                                        <p className="text-2xl font-bold text-emerald-400">{cleanCount}</p>
                                        <p className="text-[10px] uppercase text-emerald-400/60 tracking-wider mt-1">Clean</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-orange-900/20 border border-orange-500/10 text-center">
                                        <p className="text-2xl font-bold text-orange-400">{criticalCount}</p>
                                        <p className="text-[10px] uppercase text-orange-400/60 tracking-wider mt-1">Critical</p>
                                    </div>
                                </div>

                                {/* Bias Rate */}
                                {entries.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-white/[0.06]">
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-[var(--text-muted)]">Bias Rate</span>
                                            <span className="text-white font-mono">
                                                {((biasCount / entries.length) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-500 to-red-500 rounded-full transition-all duration-500"
                                                style={{ width: `${(biasCount / entries.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Engine Info Card */}
                        <div className="rounded-2xl bg-[var(--bg-card)]/[0.03] backdrop-blur-sm border border-white/[0.06] p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-4 h-4 text-violet-400" />
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-faint)]">Engine Status</h3>
                            </div>

                            <div className="space-y-0 text-sm">
                                <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
                                    <span className="text-[var(--text-muted)] flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-400" /> Tier 1 (Heuristic)
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">Active</span>
                                </div>
                                <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
                                    <span className="text-[var(--text-muted)] flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-violet-400" /> Tier 2 (BERT)
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${bertAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-[var(--text-muted)] border-slate-500/20'}`}>
                                        {bertAvailable ? 'Active' : 'Unavailable'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04]">
                                    <span className="text-[var(--text-muted)] flex items-center gap-2">
                                        <Users className="w-4 h-4 text-cyan-400" /> Speaker Roles
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">Active</span>
                                </div>
                                <div className="flex items-center justify-between py-2.5">
                                    <span className="text-[var(--text-muted)] flex items-center gap-2">
                                        <span className="text-violet-400">{scenarioLabels[scenario]?.icon}</span>
                                        Active Scenario
                                    </span>
                                    <span className="text-white font-medium text-xs bg-[var(--bg-card)]/10 px-2 py-0.5 rounded-md border border-white/10">{scenarioLabels[scenario]?.label}</span>
                                </div>
                            </div>
                        </div>

                        {/* Report Generation Button */}
                        {entries.length > 0 && (
                            <button
                                onClick={generateReport}
                                disabled={isGeneratingReport || connectionStatus === 'connecting'}
                                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {isGeneratingReport ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Generating Report...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        End Session & Generate Report
                                    </>
                                )}
                            </button>
                        )}

                        {/* How it Works */}
                        <div className="rounded-2xl bg-[var(--bg-card)]/[0.03] backdrop-blur-sm border border-white/[0.06] p-5">
                            <h4 className="font-semibold text-sm text-[var(--text-faint)] mb-3">How It Works</h4>
                            <div className="space-y-2 text-xs text-[var(--text-muted)]">
                                <p className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0 text-[10px] mt-0.5">1</span>
                                    Your browser captures speech via Web Speech API (zero cloud dependency)
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0 text-[10px] mt-0.5">2</span>
                                    Text is sent to the backend via WebSocket for instant Tier 1 heuristic scan (&lt;5ms)
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0 text-[10px] mt-0.5">3</span>
                                    If bias is detected, Tier 2 BERT-ensemble deep analysis runs instantly (~50ms)
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0 text-[10px] mt-0.5">4</span>
                                    Nudges appear in real-time with severity levels, affected groups, and suggestions
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════
                        RIGHT PANEL — Live Analysis Feed
                    ═══════════════════════════════════════════════════════════ */}
                    <div className="lg:col-span-8">
                        <div className="rounded-2xl bg-[var(--bg-card)]/[0.03] backdrop-blur-sm border border-white/[0.06] min-h-[680px] flex flex-col">

                            {/* Feed Header */}
                            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Eye className="w-5 h-5 text-cyan-400" />
                                    <h2 className="text-lg font-semibold text-white">Live Analysis Feed</h2>
                                    {isListening && (
                                        <span className="flex h-2.5 w-2.5 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                        </span>
                                    )}
                                </div>
                                {entries.length > 0 && (
                                    <span className="text-xs text-[var(--text-secondary)]">{entries.length} segments analyzed</span>
                                )}
                            </div>

                            {/* Feed Content */}
                            <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '640px' }}>
                                {entries.length === 0 && !isListening ? (
                                    // Empty State
                                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-20">
                                        <div className="w-20 h-20 rounded-2xl bg-[var(--bg-card)]/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
                                            <Mic className="w-9 h-9 text-[var(--text-secondary)]" />
                                        </div>
                                        <p className="text-lg font-medium text-[var(--text-muted)] mb-2">Ready to Listen</p>
                                        <p className="text-sm text-[var(--text-secondary)] text-center max-w-md">
                                            Click the microphone button to start real-time bias detection.
                                            Speak naturally — analysis results will appear here instantly.
                                        </p>
                                        <div className="mt-6 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                            <Sparkles className="w-3 h-3 text-violet-500" />
                                            Powered by dual-tier AI analysis engine
                                        </div>
                                    </div>
                                ) : entries.length === 0 && isListening ? (
                                    // Listening but no results yet
                                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] py-20">
                                        <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 animate-pulse">
                                            <Volume2 className="w-9 h-9 text-violet-400" />
                                        </div>
                                        <p className="text-lg font-medium text-violet-300 mb-2">Listening...</p>
                                        <p className="text-sm text-[var(--text-secondary)] text-center max-w-md">
                                            Speak into your microphone. Your speech will be transcribed and analyzed for bias in real-time.
                                        </p>
                                    </div>
                                ) : (
                                    // Analysis entries
                                    entries.map((entry) => {
                                        const colors = severityColors[entry.severity] || severityColors.none;
                                        return (
                                            <div
                                                key={entry.id}
                                                className={`rounded-xl border transition-all duration-500 ${entry.is_biased
                                                    ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                                                    : 'bg-[var(--bg-card)]/[0.02] border-white/[0.06] hover:bg-[var(--bg-card)]/[0.04]'
                                                    }`}
                                            >
                                                {/* Entry Header */}
                                                <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.04]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">{entry.timestamp}</span>
                                                        {entry.speaker_role && entry.speaker_role.role !== 'participant' && (
                                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-medium">
                                                                {entry.speaker_role.role}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {entry.has_deep_analysis && (
                                                            <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-medium flex items-center gap-1">
                                                                <Brain className="w-2.5 h-2.5" /> Deep Analysis
                                                            </span>
                                                        )}
                                                        {entry.is_biased ? (
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
                                                                <ShieldAlert className="w-3 h-3 mr-1" />
                                                                {entry.severity}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Clean
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Entry Body */}
                                                <div className="px-4 py-3">
                                                    <p className={`text-sm leading-relaxed ${entry.is_biased ? colors.text : 'text-[var(--text-faint)]'}`}>
                                                        &quot;{entry.text}&quot;
                                                    </p>

                                                    {/* Tier 1 Flags */}
                                                    {entry.is_biased && entry.tier1.flags.length > 0 && (
                                                        <div className="mt-3 space-y-2">
                                                            {entry.tier1.flags.map((flag, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-black/20 border border-white/[0.04] text-xs">
                                                                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="font-semibold text-white">{flag.type}</span>
                                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${flag.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                                                                                flag.severity === 'high' ? 'bg-orange-500/20 text-orange-300' :
                                                                                    flag.severity === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                                                                        'bg-yellow-500/20 text-yellow-300'
                                                                                }`}>
                                                                                {flag.severity}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[var(--text-muted)]">
                                                                            Group: <span className="text-[var(--text-faint)]">{flag.group}</span>
                                                                            {flag.matched_text?.length > 0 && (
                                                                                <> · Match: <span className="text-red-300 font-mono">&quot;{flag.matched_text[0]}&quot;</span></>
                                                                            )}
                                                                        </p>
                                                                        {flag.note && (
                                                                            <p className="mt-1 text-[var(--text-secondary)] italic">{flag.note}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Tier 2 Deep Analysis */}
                                                    {entry.tier2 && !entry.tier2.error && (
                                                        <div className="mt-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <Brain className="w-3 h-3 text-violet-400" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                                                                    Deep Contextual Analysis
                                                                    {entry.tier2.model_used && ` · ${entry.tier2.model_used}`}
                                                                </span>
                                                            </div>
                                                            {entry.tier2.explanation && (
                                                                <p className="text-xs text-[var(--text-faint)] leading-relaxed mb-2">
                                                                    {entry.tier2.explanation}
                                                                </p>
                                                            )}
                                                            {entry.tier2.suggestion && (
                                                                <div className="flex items-start gap-1.5 text-xs text-cyan-300/80">
                                                                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                                                                    <span><strong>Suggestion:</strong> {entry.tier2.suggestion}</span>
                                                                </div>
                                                            )}
                                                            {entry.tier2.affected_groups && entry.tier2.affected_groups.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {entry.tier2.affected_groups.map((g, i) => (
                                                                        <span key={i} className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-200 text-[10px]">
                                                                            {g}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── REPORT MODAL OVERLAY ── */}
            {showReportModal && report && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[var(--bg-primary)] border border-violet-500/30 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between bg-[var(--bg-card)]/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Speech Bias Report</h2>
                                    <p className="text-xs text-[var(--text-muted)]">Post-session analysis based on your transcript</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="p-2 rounded-lg bg-[var(--bg-card)]/5 hover:bg-[var(--bg-card)]/10 text-[var(--text-muted)] hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Score & Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md:col-span-1 rounded-2xl bg-[var(--bg-card)]/[0.03] border border-white/[0.06] p-6 flex flex-col items-center justify-center text-center">
                                    <div className="relative mb-2">
                                        <svg className="w-24 h-24 transform -rotate-90">
                                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[var(--text-primary)]" />
                                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                                                strokeDasharray="251.2"
                                                strokeDashoffset={251.2 - (251.2 * (report.overall_score || 0)) / 10}
                                                className="text-violet-500 transition-all duration-1000 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-3xl font-bold text-white">{report.overall_score || 0}<span className="text-lg text-[var(--text-secondary)]">/10</span></span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-[var(--text-faint)] uppercase tracking-wider">Inclusivity Score</p>
                                </div>

                                <div className="md:col-span-3 rounded-2xl bg-violet-500/5 border border-violet-500/20 p-6">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-300 mb-3">
                                        <Sparkles className="w-4 h-4" /> Executive Summary
                                    </h3>
                                    <p className="text-[var(--text-faint)] text-sm leading-relaxed">
                                        {report.summary || 'No summary provided.'}
                                    </p>
                                </div>
                            </div>

                            {/* Dynamics & Patterns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="rounded-2xl bg-[var(--bg-card)]/[0.03] border border-white/[0.06] p-6">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-cyan-400 mb-4">
                                        <Users className="w-4 h-4" /> Speaker Dynamics
                                    </h3>
                                    <p className="text-[var(--text-faint)] text-sm leading-relaxed mb-4">
                                        {report.speaker_dynamics || 'No dynamics observed.'}
                                    </p>

                                    <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Key Patterns Observed</h4>
                                    <ul className="space-y-2">
                                        {report.primary_bias_patterns && report.primary_bias_patterns.length > 0 ? (
                                            report.primary_bias_patterns.map((pattern: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-faint)]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                                                    {pattern}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="text-sm text-[var(--text-secondary)] italic">No significant patterns flagged.</li>
                                        )}
                                    </ul>
                                </div>

                                {/* Coaching Suggestions */}
                                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6">
                                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-indigo-300 mb-4">
                                        <Brain className="w-4 h-4" /> Coaching & Suggestions
                                    </h3>
                                    <div className="space-y-4">
                                        {report.key_suggestions && report.key_suggestions.length > 0 ? (
                                            report.key_suggestions.map((suggestion: string, idx: number) => (
                                                <div key={idx} className="flex gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 text-xs font-bold">
                                                        {idx + 1}
                                                    </div>
                                                    <p className="text-sm text-slate-200 mt-0.5">{suggestion}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-[var(--text-muted)] italic">Keep up the good work! No major coaching needed based on this session.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-white/[0.06] bg-[var(--bg-card)]/[0.02] flex items-center justify-between">
                            <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" />
                                Analyzing Engine: {report.model_used || 'BERT Ensemble'}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-faint)] hover:text-white hover:bg-[var(--bg-card)]/5 transition-colors"
                                >
                                    Close Check
                                </button>
                                <button
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                                    onClick={() => {
                                        const jsonData = JSON.stringify(report, null, 2);
                                        const blob = new Blob([jsonData], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `speech-bias-report-${new Date().toISOString().split('T')[0]}.json`;
                                        a.click();
                                    }}
                                >
                                    <Download className="w-4 h-4" /> Export JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
