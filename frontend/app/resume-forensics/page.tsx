"use client";

import React, { useState, useMemo } from "react";
import axios from "axios";
import { API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, Upload, AlertTriangle, CheckCircle, CheckCircle2, XCircle, Brain, GraduationCap,
    MessageSquare, Target, Clock, Fingerprint, TrendingDown, Zap, FileText, Users as UsersIcon
} from "lucide-react";

// Reuse all the type definitions from the original (ForensicsResult, etc.)
interface ForensicsResult { total_candidates: number; total_selected: number; total_rejected: number; overall_selection_rate: number; qualification_controlled_bias: any; name_proxy_analysis: any; college_pedigree_analysis: any; language_disparity: any; skill_outcome_mismatch: any; experience_penalty: any; forensics_score: any; bias_detected: boolean; parse_summary?: any; }

function parseCSV(text: string): any[] {
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
            const lh = h.toLowerCase(), v = values[i] || "";
            if (lh.includes("name")) obj.name = v;
            else if (lh.includes("identity") || lh.includes("gender")) obj.identities = v.includes(";") ? v.split(";") : [v];
            else if (lh.includes("select") || lh.includes("hire")) obj.selected = ["1", "true", "yes"].includes(v.toLowerCase());
            else if (lh.includes("score")) obj.score = parseFloat(v) || undefined;
            else if (lh.includes("experience")) obj.experience = parseFloat(v) || undefined;
            else if (lh.includes("college")) obj.college = v;
            else if (lh.includes("skill")) obj.skills = v;
            else if (lh.includes("note")) obj.notes = v;
            else obj[h] = v;
        });
        if (obj.selected === undefined) obj.selected = false;
        if (!obj.name) obj.name = `candidate_${Math.random().toString(36).slice(2, 8)}`;
        return obj;
    });
}

function ModuleCard({ icon: Icon, title, description, biasDetected, children, color }: any) {
    return (
        <Card className={`glass-card border-2 ${biasDetected ? "border-red-500/40" : "border-slate-700/50"}`}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
                        <div><h3 className="text-lg font-bold text-white">{title}</h3><p className="text-xs text-slate-400">{description}</p></div>
                    </div>
                    {biasDetected ? <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Bias</span> : <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full"><CheckCircle className="w-3.5 h-3.5 inline mr-1" />Fair</span>}
                </div>
                {children}
            </CardContent>
        </Card>
    );
}

function ScoreGauge({ score, severity }: { score: number; severity: string }) {
    const color = severity === "Critical" ? "from-red-500 to-rose-600" : severity === "High" ? "from-orange-500 to-amber-500" : "from-emerald-400 to-cyan-400";
    const textColor = severity === "Critical" ? "text-red-400" : severity === "High" ? "text-orange-400" : "text-emerald-400";
    return (
        <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(51,65,85,0.5)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#g)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * 264} 264`} />
                    <defs><linearGradient id="g"><stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-2xl font-bold bg-gradient-to-b ${color} bg-clip-text text-transparent`}>{score}</span></div>
            </div>
            <div><p className={`text-xl font-bold ${textColor}`}>{severity}</p><p className="text-slate-400 text-sm">Score</p></div>
        </div>
    );
}

export default function ResumeForensicsPage() {
    const router = useRouter();
    const { getToken, logout } = useAuth();
    const [mode, setMode] = useState<"pdf" | "csv">("pdf");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [rejectedFiles, setRejectedFiles] = useState<File[]>([]);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<ForensicsResult | null>(null);

    const totalFiles = selectedFiles.length + rejectedFiles.length;

    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        const text = await file.text();
        setCandidates(parseCSV(text));
        setResult(null);
    };

    const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "selected" | "rejected") => {
        const files = Array.from(e.target.files || []);
        if (type === "selected") setSelectedFiles(prev => [...prev, ...files].slice(0, 50));
        else setRejectedFiles(prev => [...prev, ...files].slice(0, 50));
        setResult(null);
    };

    const removeFile = (type: "selected" | "rejected", idx: number) => {
        if (type === "selected") setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
        else setRejectedFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleAnalyze = async () => {
        const token = getToken();
        if (!token) { router.push("/landing"); return; }

        if (mode === "csv" && candidates.length < 5) {
            alert("Need at least 5 candidates"); return;
        }
        if (mode === "pdf" && totalFiles < 2) {
            alert("Upload at least 1 selected & 1 rejected resume"); return;
        }

        setAnalyzing(true);
        setResult(null);

        try {
            if (mode === "csv") {
                const res = await axios.post(`${API}/analyze-resume-forensics`, { candidates }, { headers: { Authorization: `Bearer ${token}` } });
                setResult(res.data.analysis);
            } else {
                const formData = new FormData();
                selectedFiles.forEach(f => formData.append("selected_files", f));
                rejectedFiles.forEach(f => formData.append("rejected_files", f));
                const res = await axios.post(`${API}/upload-resume-forensics`, formData, { headers: { Authorization: `Bearer ${token}` } });
                setResult(res.data.analysis);
            }
        } catch (error: any) {
            console.error(error);
            if (axios.isAxiosError(error) && error.response?.status === 401) { logout(); return; }
            alert(error.response?.data?.detail || "Analysis failed");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button onClick={() => router.push("/dashboard")} className="glass-card"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
                        <div><h1 className="text-3xl font-bold gradient-text">Resume Forensics</h1><p className="text-slate-400 text-sm">Hiring Bias Detection for Indian IT</p></div>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-2"><Zap className="w-4 h-4 text-indigo-400 inline mr-2" /><span className="text-indigo-300 text-xs">6 Modules • 50 Batch Limit</span></div>
                </div>

                <Card className="glass-card mb-8">
                    <CardContent className="p-6">
                        <h2 className="text-2xl font-semibold text-white mb-4">Upload Mode</h2>
                        <div className="flex gap-4 mb-6">
                            <button onClick={() => setMode("pdf")} className={`px-6 py-3 rounded-lg font-medium transition ${mode === "pdf" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}><FileText className="w-5 h-5 inline mr-2" />PDF Resumes</button>
                            <button onClick={() => setMode("csv")} className={`px-6 py-3 rounded-lg font-medium transition ${mode === "csv" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}><FileText className="w-5 h-5 inline mr-2" />CSV Data</button>
                        </div>

                        {mode === "pdf" ? (
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-emerald-900/10 border-2 border-dashed border-emerald-500/30 rounded-xl">
                                        <UsersIcon className="w-8 h-8 text-emerald-400 mb-3" />
                                        <h3 className="text-lg font-bold text-emerald-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /> Selected Resumes</h3>
                                        <input type="file" accept=".pdf,.txt" multiple onChange={(e) => handlePDFUpload(e, "selected")} className="hidden" id="sel" />
                                        <label htmlFor="sel" className="block px-4 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer text-center hover:bg-emerald-700"><Upload className="w-4 h-4 inline mr-2" />Upload PDFs ({selectedFiles.length}/50)</label>
                                        {selectedFiles.map((f, i) => <div key={i} className="mt-2 flex items-center justify-between text-sm bg-slate-800/50 px-3 py-2 rounded"><span className="text-emerald-300 truncate">{f.name}</span><button onClick={() => removeFile("selected", i)} className="text-red-400 hover:text-red-300">×</button></div>)}
                                    </div>
                                    <div className="p-6 bg-red-900/10 border-2 border-dashed border-red-500/30 rounded-xl">
                                        <UsersIcon className="w-8 h-8 text-red-400 mb-3" />
                                        <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2"><XCircle className="w-5 h-5" /> Rejected Resumes</h3>
                                        <input type="file" accept=".pdf,.txt" multiple onChange={(e) => handlePDFUpload(e, "rejected")} className="hidden" id="rej" />
                                        <label htmlFor="rej" className="block px-4 py-2 bg-red-600 text-white rounded-lg cursor-pointer text-center hover:bg-red-700"><Upload className="w-4 h-4 inline mr-2" />Upload PDFs ({rejectedFiles.length}/50)</label>
                                        {rejectedFiles.map((f, i) => <div key={i} className="mt-2 flex items-center justify-between text-sm bg-slate-800/50 px-3 py-2 rounded"><span className="text-red-300 truncate">{f.name}</span><button onClick={() => removeFile("rejected", i)} className="text-red-400 hover:text-red-300">×</button></div>)}
                                    </div>
                                </div>
                                <p className="text-slate-400 text-sm">Total: {totalFiles}/50 resumes • PDFs are auto-parsed for name, college, skills, experience</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-400 text-sm mb-4">Upload CSV with columns: Name, Identity, Selected, Score, College, Skills, Notes</p>
                                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" id="csv" />
                                <label htmlFor="csv" className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"><Upload className="w-5 h-5 inline mr-2" />Choose CSV</label>
                                {csvFile && <span className="ml-4 text-green-400">{csvFile.name} ({candidates.length} candidates)</span>}
                            </div>
                        )}

                        {((mode === "pdf" && totalFiles >= 2) || (mode === "csv" && candidates.length >= 5)) && (
                            <Button onClick={handleAnalyze} disabled={analyzing} className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3">
                                {analyzing ? <><span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full inline-block mr-2" />Analyzing...</> : `Analyze ${mode === "pdf" ? totalFiles : candidates.length} Candidates`}
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {result && (
                    <div className="space-y-6 animate-fade-in-up">
                        <Card className="glass-card border-2 border-indigo-500/30">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div><h2 className="text-2xl font-bold text-white">Summary</h2></div>
                                    <ScoreGauge score={result.forensics_score.overall_score} severity={result.forensics_score.severity} />
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="p-3 bg-slate-800/60 rounded-xl text-center"><p className="text-slate-400 text-xs">Total</p><p className="text-2xl font-bold text-white">{result.total_candidates}</p></div>
                                    <div className="p-3 bg-slate-800/60 rounded-xl text-center"><p className="text-slate-400 text-xs">Selected</p><p className="text-2xl font-bold text-emerald-400">{result.total_selected}</p></div>
                                    <div className="p-3 bg-slate-800/60 rounded-xl text-center"><p className="text-slate-400 text-xs">Rejected</p><p className="text-2xl font-bold text-red-400">{result.total_rejected}</p></div>
                                    <div className="p-3 bg-slate-800/60 rounded-xl text-center"><p className="text-slate-400 text-xs">Modules Flagged</p><p className="text-2xl font-bold text-orange-400">{result.forensics_score.modules_flagged}/6</p></div>
                                </div>
                                {result.forensics_score.key_findings?.length > 0 && (
                                    <div className="mt-6 p-4 bg-red-900/15 border-l-4 border-red-500 rounded-r">
                                        <p className="text-red-300 font-semibold mb-2"><AlertTriangle className="w-4 h-4 inline mr-2" />Key Findings</p>
                                        <ul>{result.forensics_score.key_findings.map((f: string, i: number) => <li key={i} className="text-red-200/80 text-sm">• {f}</li>)}</ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <ModuleCard icon={Brain} title="Qualification-Controlled Bias" description="Equalized odds analysis" biasDetected={result.qualification_controlled_bias.bias_detected} color="bg-purple-500/20 text-purple-400">
                            <p className="text-slate-400 text-sm">{result.qualification_controlled_bias.note || "Analysis complete"}</p>
                        </ModuleCard>

                        <ModuleCard icon={Fingerprint} title="Name-Proxy Bias" description="Surname-community correlation" biasDetected={result.name_proxy_analysis.bias_detected} color="bg-amber-500/20 text-amber-400">
                            <p className="text-slate-400 text-sm">{result.name_proxy_analysis.note || `Max disparity: ${((result.name_proxy_analysis.max_disparity || 0) * 100).toFixed(1)}%`}</p>
                        </ModuleCard>

                        <ModuleCard icon={GraduationCap} title="College Pedigree Bias" description="IIT/NIT preference detection" biasDetected={result.college_pedigree_analysis.bias_detected} color="bg-cyan-500/20 text-cyan-400">
                            {result.college_pedigree_analysis.pedigree_premium && <p className="text-slate-300 text-sm">Tier-1 selected at <strong>{result.college_pedigree_analysis.pedigree_premium}x</strong> rate vs Tier-3</p>}
                        </ModuleCard>

                        <ModuleCard icon={MessageSquare} title="Language Disparity" description="Interviewer note sentiment" biasDetected={result.language_disparity.bias_detected} color="bg-rose-500/20 text-rose-400">
                            <p className="text-slate-400 text-sm">{result.language_disparity.coded_bias_detected?.length || 0} coded bias terms found</p>
                        </ModuleCard>

                        <ModuleCard icon={Target} title="Skill-Outcome Mismatch" description="Score threshold disparity" biasDetected={result.skill_outcome_mismatch.bias_detected} color="bg-indigo-500/20 text-indigo-400">
                            <p className="text-slate-400 text-sm">{result.skill_outcome_mismatch.finding || "No threshold disparity"}</p>
                        </ModuleCard>

                        <ModuleCard icon={Clock} title="Experience Penalty" description="Experience correlation check" biasDetected={result.experience_penalty.bias_detected} color="bg-teal-500/20 text-teal-400">
                            {result.experience_penalty.experience_selection_correlation !== undefined && <p className="text-slate-400 text-sm">Correlation: {result.experience_penalty.experience_selection_correlation > 0 ? "+" : ""}{result.experience_penalty.experience_selection_correlation}</p>}
                        </ModuleCard>
                    </div>
                )}
            </div>
        </main>
    );
}
