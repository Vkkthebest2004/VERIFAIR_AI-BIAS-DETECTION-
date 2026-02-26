'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, AlertCircle, ShieldAlert, CheckCircle2, FileAudio, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { API } from '@/lib/api';
import axios from 'axios';
import { cn } from '@/lib/utils';

interface AnalysisChunk {
    id: string;
    text: string;
    is_biased: boolean;
    timestamp: string;
    bias_flags: Array<{
        identity: string;
        target: string;
        z_score: number;
        explanation?: string;
    }>;
}

export default function LiveAuditPage() {
    const [isRecording, setIsRecording] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [chunks, setChunks] = useState<AnalysisChunk[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    const { user, loading, getToken } = useAuth();
    const router = useRouter();

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const allAudioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopRecording = useCallback(() => {
        setIsRecording(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (chunkIntervalRef.current) {
            clearInterval(chunkIntervalRef.current);
            chunkIntervalRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }

        if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            webSocketRef.current.close();
        }
    }, []);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
        return () => {
            stopRecording();
        };
    }, [loading, user, router, stopRecording]);

    const connectWebSocket = () => {
        setConnectionStatus('connecting');
        setErrorMessage('');
        allAudioChunksRef.current = [];
        setRecordingDuration(0);

        const wsUrl = process.env.NEXT_PUBLIC_API_URL
            ? `${process.env.NEXT_PUBLIC_API_URL.replace('http', 'ws')}/api/v1/ws/live-audit?ngrok-skip-browser-warning=true`
            : `ws://localhost:8000/api/v1/ws/live-audit`;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setConnectionStatus('connected');
                startAudioCapture();
                timerRef.current = setInterval(() => {
                    setRecordingDuration(prev => prev + 1);
                }, 1000);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.status === 'success' && data.analysis) {
                        const newChunk: AnalysisChunk = {
                            id: Math.random().toString(36).substring(7),
                            text: data.text,
                            is_biased: data.analysis.is_biased,
                            timestamp: new Date().toLocaleTimeString(),
                            bias_flags: data.analysis.bias_flags || []
                        };
                        setChunks(prev => [newChunk, ...prev]);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message', error);
                }
            };

            ws.onerror = () => {
                setConnectionStatus('error');
                setErrorMessage('Failed to connect to real-time analysis server.');
                stopRecording();
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');
            };

            webSocketRef.current = ws;
        } catch {
            setConnectionStatus('error');
            setErrorMessage('Could not establish WebSocket connection.');
        }
    };

    const startAudioCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            streamRef.current = stream;
            const options = { mimeType: 'audio/webm' };

            const mainRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mainRecorder;

            mainRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    allAudioChunksRef.current.push(event.data);
                }
            };

            mainRecorder.start(1000);
            setIsRecording(true);

            const captureStandaloneChunk = () => {
                if (!streamRef.current || webSocketRef.current?.readyState !== WebSocket.OPEN) return;

                try {
                    const chunkRecorder = new MediaRecorder(streamRef.current, options);
                    const localChunks: BlobPart[] = [];

                    chunkRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) localChunks.push(e.data);
                    };

                    chunkRecorder.onstop = () => {
                        const blob = new Blob(localChunks, { type: 'audio/webm' });
                        if (webSocketRef.current?.readyState === WebSocket.OPEN && blob.size > 500) {
                            webSocketRef.current.send(blob);
                        }
                    };

                    chunkRecorder.start();
                    setTimeout(() => {
                        if (chunkRecorder.state !== 'inactive') chunkRecorder.stop();
                    }, 2000);
                } catch (e) {
                    console.warn("Could not capture standalone live chunk", e);
                }
            };

            chunkIntervalRef.current = setInterval(captureStandaloneChunk, 2000);
            captureStandaloneChunk();

        } catch (err) {
            console.error('Error accessing microphone:', err);
            setErrorMessage('Microphone access denied or not available.');
            setConnectionStatus('error');
            if (webSocketRef.current) webSocketRef.current.close();
        }
    };

    const handleStart = () => {
        setChunks([]);
        connectWebSocket();
    };

    const handleStopAndAnalyze = async () => {
        stopRecording();
        setIsAnalyzing(true);
        setErrorMessage('');

        try {
            const token = getToken();
            if (!token) {
                setErrorMessage('Authentication required.');
                setIsAnalyzing(false);
                return;
            }

            const fullAudioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm' });

            if (fullAudioBlob.size < 1000) {
                setErrorMessage('Recording too short. Please record at least a few seconds of speech.');
                setIsAnalyzing(false);
                return;
            }

            const formData = new FormData();
            formData.append('audio', fullAudioBlob, 'recording.webm');
            formData.append('context', 'General');

            const response = await axios.post(`${API}/audit-audio`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 120000,
            });

            const results = response.data;
            if (Array.isArray(results) && results.length > 0 && results[0].record_id) {
                router.push(`/results/${results[0].record_id}`);
            } else {
                setErrorMessage('Analysis completed but no results were returned.');
                setIsAnalyzing(false);
            }

        } catch (err) {
            console.error('Full analysis error:', err);
            setErrorMessage('Failed to analyze the recording. Make sure the backend is running.');
            setIsAnalyzing(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const biasCount = chunks.filter(c => c.is_biased).length;
    const cleanCount = chunks.filter(c => !c.is_biased).length;

    return (
        <div className="min-h-screen font-sans" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

                {/* Header */}
                <div className="mb-8 sm:mb-10">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-sm font-medium mb-4 inline-flex items-center gap-1.5 hover:underline"
                        style={{ color: "var(--accent)" }}
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.03em]">
                        Live Bias Audit
                    </h1>
                    <p className="text-sm sm:text-base mt-1" style={{ color: "var(--text-secondary)" }}>
                        Record speech, get live nudges, then generate a full audit report.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">

                    {/* Control Panel */}
                    <div className="md:col-span-1 space-y-4">
                        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                            <div className="p-5 sm:p-6">
                                <h3 className="text-base font-semibold mb-1">Microphone Control</h3>
                                <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>Record → Live nudges → Full report</p>

                                {errorMessage && (
                                    <div className="w-full p-3 rounded-xl mb-4 flex items-start gap-2 text-sm bg-[#ff3b30]/[0.06] border border-[#ff3b30]/10 text-[#ff3b30]">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <p>{errorMessage}</p>
                                    </div>
                                )}

                                <div className="flex flex-col items-center space-y-5">
                                    {/* Duration */}
                                    {(isRecording || recordingDuration > 0) && (
                                        <div className="text-center">
                                            <p className="text-3xl font-mono font-semibold">{formatDuration(recordingDuration)}</p>
                                            {isRecording && <p className="text-xs text-[#ff3b30] animate-pulse mt-1 font-medium">Recording...</p>}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3 w-full">
                                        {!isRecording && !isAnalyzing ? (
                                            <button
                                                onClick={handleStart}
                                                disabled={connectionStatus === 'connecting'}
                                                className="w-full py-4 text-sm font-semibold bg-[#34c759] text-white rounded-xl hover:bg-[#2db84e] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {connectionStatus === 'connecting' ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" /> Connecting...</>
                                                ) : (
                                                    <><Mic className="w-5 h-5" /> Start Recording</>
                                                )}
                                            </button>
                                        ) : isAnalyzing ? (
                                            <button disabled className="w-full py-4 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2" style={{ background: "var(--accent)", opacity: 0.7 }}>
                                                <Loader2 className="w-5 h-5 animate-spin" /> Analyzing...
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={handleStopAndAnalyze}
                                                    className="w-full py-4 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                                    style={{ background: "var(--accent)" }}
                                                >
                                                    <FileAudio className="w-4 h-4" /> Generate Full Report
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={stopRecording}
                                                    className="w-full py-3 text-xs font-medium text-[#ff3b30] rounded-xl border border-[#ff3b30]/20 hover:bg-[#ff3b30]/[0.04] transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Square className="w-3.5 h-3.5" /> Stop Without Report
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    {chunks.length > 0 && (
                                        <div className="w-full grid grid-cols-3 gap-2 pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
                                            {[
                                                { v: chunks.length, l: "Chunks", c: "var(--text-primary)" },
                                                { v: biasCount, l: "Flagged", c: "#ff3b30" },
                                                { v: cleanCount, l: "Clean", c: "#34c759" },
                                            ].map((s, i) => (
                                                <div key={i} className="text-center">
                                                    <p className="text-lg font-semibold" style={{ color: s.c }}>{s.v}</p>
                                                    <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{s.l}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Status */}
                                    <div className="w-full flex justify-between items-center text-xs pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
                                        <span style={{ color: "var(--text-muted)" }}>Status:</span>
                                        <span className={cn(
                                            "font-medium",
                                            connectionStatus === 'connected' ? 'text-[#34c759]' :
                                                connectionStatus === 'error' ? 'text-[#ff3b30]' :
                                                    connectionStatus === 'connecting' ? 'text-[#ff9500]' : 'text-[var(--text-muted)]'
                                        )}>
                                            {connectionStatus === 'connected' && 'Live & Listening'}
                                            {connectionStatus === 'connecting' && 'Connecting...'}
                                            {connectionStatus === 'error' && 'Connection Failed'}
                                            {connectionStatus === 'disconnected' && 'Standby'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* How It Works */}
                        <div className="rounded-2xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                            <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>How It Works</h4>
                            <div className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                                <p>1. Click &quot;Start Recording&quot; and speak</p>
                                <p>2. Get live bias nudges in real-time</p>
                                <p>3. Click &quot;Generate Full Report&quot;</p>
                                <p>4. View comprehensive analysis results</p>
                            </div>
                        </div>
                    </div>

                    {/* Live Transcript */}
                    <div className="md:col-span-2">
                        <div className="rounded-2xl overflow-hidden min-h-[500px] flex flex-col" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
                                <h3 className="text-base font-semibold">Live Transcript & Nudges</h3>
                                {isRecording && (
                                    <span className="flex h-2.5 w-2.5 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3b30] opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff3b30]"></span>
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {isAnalyzing ? (
                                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                                        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "var(--accent)" }} />
                                        <div>
                                            <p className="font-semibold text-lg">Generating Full Audit Report</p>
                                            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Transcribing → Chunking → 6-stage analysis → LLM explanations...</p>
                                            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>This may take 30–60 seconds for longer recordings.</p>
                                        </div>
                                    </div>
                                ) : chunks.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4" style={{ color: "var(--text-muted)" }}>
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-secondary)" }}>
                                            <Mic className="h-7 w-7 opacity-30" />
                                        </div>
                                        <p className="text-sm">Click &quot;Start Recording&quot; and begin speaking.<br />Live bias nudges will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="p-4 space-y-3">
                                        {chunks.map((chunk) => (
                                            <div
                                                key={chunk.id}
                                                className={cn(
                                                    "p-4 rounded-xl border transition-all",
                                                    chunk.is_biased
                                                        ? "bg-[#ff3b30]/[0.03] border-[#ff3b30]/15"
                                                        : "border-[var(--border-primary)]"
                                                )}
                                                style={{ background: chunk.is_biased ? undefined : "var(--bg-card)" }}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{chunk.timestamp}</span>
                                                    {chunk.is_biased ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ff3b30]/10 text-[#ff3b30]">
                                                            <ShieldAlert className="w-3 h-3 mr-1" /> Bias Flagged
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#34c759]/10 text-[#34c759]">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Clean
                                                        </span>
                                                    )}
                                                </div>

                                                <p className={cn(
                                                    "text-[15px] leading-relaxed",
                                                    chunk.is_biased ? "text-[#ff3b30] font-medium" : ""
                                                )} style={{ color: chunk.is_biased ? undefined : "var(--text-primary)" }}>
                                                    &quot;{chunk.text}&quot;
                                                </p>

                                                {chunk.is_biased && chunk.bias_flags.length > 0 && (
                                                    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid rgba(255,59,48,0.1)" }}>
                                                        {chunk.bias_flags.map((flag, idx) => (
                                                            <div key={idx} className="rounded-lg p-2.5 text-sm flex justify-between items-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}>
                                                                <span className="font-semibold text-[#ff3b30] text-xs">
                                                                    {flag.identity} {flag.target ? `→ ${flag.target}` : ''}
                                                                </span>
                                                                <span className="text-[#ff3b30] font-mono text-xs">
                                                                    Z: {flag.z_score.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
