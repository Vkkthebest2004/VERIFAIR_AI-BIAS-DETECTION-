'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, AlertCircle, ShieldAlert, CheckCircle2, FileAudio, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { API } from '@/lib/api';
import axios from 'axios';

// Represents a single analyzed chunk of audio (live co-pilot)
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

    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const allAudioChunksRef = useRef<Blob[]>([]);  // Store ALL chunks for full analysis
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
        allAudioChunksRef.current = []; // Reset stored audio
        setRecordingDuration(0);

        const wsUrl = process.env.NEXT_PUBLIC_API_URL
            ? `${process.env.NEXT_PUBLIC_API_URL.replace('http', 'ws')}/api/v1/ws/live-audit?ngrok-skip-browser-warning=true`
            : `ws://localhost:8000/api/v1/ws/live-audit`;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setConnectionStatus('connected');
                startAudioCapture();
                // Start timer
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

            // 1) Main Recorder: Runs continuously to collect the unbroken final audio
            const mainRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mainRecorder;

            mainRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    allAudioChunksRef.current.push(event.data);
                }
            };

            mainRecorder.start(1000); // 1-second chunks for the final Blob
            setIsRecording(true);

            // 2) Live Feedback: Create a new MediaRecorder every 2 seconds
            // This guarantees EVERY chunk sent over WebSocket has the WebM header 
            // and is instantly decodable by Whisper (Zero Latency)
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

            // Start the polling interval
            chunkIntervalRef.current = setInterval(captureStandaloneChunk, 2000);
            captureStandaloneChunk(); // fire first one immediately

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

    // ================================================================
    //  FULL ANALYSIS: Stop recording → send complete audio → get report
    // ================================================================
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

            // Combine all recorded audio chunks into a single blob
            const fullAudioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm' });

            if (fullAudioBlob.size < 1000) {
                setErrorMessage('Recording too short. Please record at least a few seconds of speech.');
                setIsAnalyzing(false);
                return;
            }

            // Send to the full analysis endpoint
            const formData = new FormData();
            formData.append('audio', fullAudioBlob, 'recording.webm');
            formData.append('context', 'General');

            const response = await axios.post(`${API}/audit-audio`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
                timeout: 120000, // 2 min timeout for long recordings
            });

            const results = response.data;
            if (Array.isArray(results) && results.length > 0 && results[0].record_id) {
                // Navigate to the full results page — same as text/CSV uploads
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
        <div className="container mx-auto py-8 px-4 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Live Bias Audit (Co-Pilot)</h1>
                <p className="text-muted-foreground">
                    Record speech, get live nudges, then generate a full audit report — same comprehensive analysis as text uploads.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Control Panel */}
                <div className="md:col-span-1 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Microphone Control</CardTitle>
                            <p className="text-sm text-slate-500">Record → Live nudges → Full report</p>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center py-6 space-y-4">

                            {errorMessage && (
                                <div className="w-full p-3 bg-red-100 text-red-800 text-sm rounded-md flex items-start gap-2">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <p>{errorMessage}</p>
                                </div>
                            )}

                            {/* Recording Duration */}
                            {(isRecording || recordingDuration > 0) && (
                                <div className="text-center">
                                    <p className="text-3xl font-mono font-bold text-slate-800">{formatDuration(recordingDuration)}</p>
                                    {isRecording && <p className="text-xs text-red-500 animate-pulse mt-1">Recording...</p>}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 w-full">
                                {!isRecording && !isAnalyzing ? (
                                    <Button
                                        onClick={handleStart}
                                        className="w-full py-8 text-lg bg-emerald-600 hover:bg-emerald-700"
                                        disabled={connectionStatus === 'connecting'}
                                    >
                                        {connectionStatus === 'connecting' ? (
                                            <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Connecting...</>
                                        ) : (
                                            <><Mic className="mr-2 h-6 w-6" /> Start Recording</>
                                        )}
                                    </Button>
                                ) : isAnalyzing ? (
                                    <Button disabled className="w-full py-8 text-lg bg-indigo-600">
                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Analyzing Full Recording...
                                    </Button>
                                ) : (
                                    <>
                                        {/* Primary: Stop & Generate Full Report */}
                                        <Button
                                            onClick={handleStopAndAnalyze}
                                            className="w-full py-6 text-base bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                        >
                                            <FileAudio className="mr-2 h-5 w-5" /> Stop & Generate Full Report
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>

                                        {/* Secondary: Just stop */}
                                        <Button
                                            onClick={stopRecording}
                                            className="w-full py-3 text-sm bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            <Square className="mr-2 h-4 w-4" /> Stop Without Report
                                        </Button>
                                    </>
                                )}
                            </div>

                            {/* Live Stats */}
                            {chunks.length > 0 && (
                                <div className="w-full grid grid-cols-3 gap-2 pt-4 border-t">
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-slate-800">{chunks.length}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Chunks</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-red-600">{biasCount}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Flagged</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-emerald-600">{cleanCount}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Clean</p>
                                    </div>
                                </div>
                            )}

                            <div className="w-full flex justify-between items-center text-sm pt-4 border-t">
                                <span className="text-muted-foreground">Status:</span>
                                <span className={`font-medium ${connectionStatus === 'connected' ? 'text-emerald-500' :
                                    connectionStatus === 'error' ? 'text-red-500' :
                                        connectionStatus === 'connecting' ? 'text-amber-500' : 'text-slate-400'
                                    }`}>
                                    {connectionStatus === 'connected' && 'Live & Listening'}
                                    {connectionStatus === 'connecting' && 'Connecting...'}
                                    {connectionStatus === 'error' && 'Connection Failed'}
                                    {connectionStatus === 'disconnected' && 'Standby'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-50 border-slate-200">
                        <CardContent className="pt-6 text-sm text-slate-600 space-y-2">
                            <h4 className="font-semibold text-slate-900 border-b pb-1 mb-2">How It Works</h4>
                            <p>1. Click &quot;Start Recording&quot; and speak</p>
                            <p>2. Get live bias nudges in real-time</p>
                            <p>3. Click &quot;Stop & Generate Full Report&quot;</p>
                            <p>4. Get the same comprehensive audit report as text/CSV uploads</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Live Transcript / Audit Feed */}
                <div className="md:col-span-2">
                    <Card className="h-full min-h-[500px] flex flex-col">
                        <CardHeader className="border-b bg-slate-50/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">Live Transcript & Nudges</CardTitle>
                                {isRecording && (
                                    <span className="flex h-3 w-3 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0 bg-slate-50/30">

                            {isAnalyzing ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-4">
                                    <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                                    <div>
                                        <p className="font-semibold text-lg text-slate-800">Generating Full Audit Report</p>
                                        <p className="text-sm mt-2">Transcribing audio → Chunking text → Running 6-stage bias analysis → Generating LLM explanations...</p>
                                        <p className="text-xs text-slate-400 mt-3">This may take 30-60 seconds for longer recordings.</p>
                                    </div>
                                </div>
                            ) : chunks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center shadow-inner">
                                        <Mic className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p>Click &quot;Start Recording&quot; and begin speaking.<br />Live bias nudges will appear here in real-time.</p>
                                    <p className="text-xs text-slate-300">When done, click &quot;Stop & Generate Full Report&quot; for comprehensive analysis.</p>
                                </div>
                            ) : (
                                <div className="p-4 space-y-4">
                                    {chunks.map((chunk) => (
                                        <div
                                            key={chunk.id}
                                            className={`p-4 rounded-lg border transition-all duration-300 ${chunk.is_biased
                                                ? 'bg-red-50/80 border-red-200 shadow-sm'
                                                : 'bg-white border-slate-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-mono text-slate-400">{chunk.timestamp}</span>
                                                {chunk.is_biased ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                        <ShieldAlert className="w-3 h-3 mr-1" />
                                                        Bias Flagged
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        Clean
                                                    </span>
                                                )}
                                            </div>

                                            <p className={`text-lg ${chunk.is_biased ? 'text-red-900 font-medium' : 'text-slate-800'}`}>
                                                &quot;{chunk.text}&quot;
                                            </p>

                                            {chunk.is_biased && chunk.bias_flags.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-red-100 space-y-2">
                                                    {chunk.bias_flags.map((flag, idx) => (
                                                        <div key={idx} className="bg-white rounded p-2 text-sm border border-red-100 flex flex-col gap-1">
                                                            <div className="flex justify-between">
                                                                <span className="font-semibold text-red-800">
                                                                    {flag.identity} {flag.target ? `→ ${flag.target}` : ''}
                                                                </span>
                                                                <span className="text-red-600 font-mono text-xs">
                                                                    Z: {flag.z_score.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
