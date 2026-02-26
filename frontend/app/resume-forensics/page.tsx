"use client";

import React, { useState } from "react";
import axios from "axios";
import { API } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
    ArrowLeft, Upload, AlertTriangle, CheckCircle, CheckCircle2, XCircle, Brain, GraduationCap,
    MessageSquare, Target, Clock, Fingerprint, TrendingDown, Zap, FileText, Users as UsersIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ForensicsResult { total_candidates: number; total_selected: number; total_rejected: number; overall_selection_rate: number; qualification_controlled_bias: any; name_proxy_analysis: any; college_pedigree_analysis: any; language_disparity: any; skill_outcome_mismatch: any; experience_penalty: any; forensics_score: any; bias_detected: boolean; parse_summary?: any; }

function parseCSV(text: string): Record<string, unknown>[] {
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ModuleCard({ icon: Icon, title, description, biasDetected, children, color }: any) {
    return (
        <div className={cn(
            "rounded-2xl overflow-hidden border-2 transition-all",
            biasDetected ? "border-[#ff3b30]/20" : "border-[var(--border-primary)]"
        )} style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
                        <div><h3 className="text-base font-semibold">{title}</h3><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{description}</p></div>
                    </div>
                    {biasDetected ? (
                        <span className="px-2.5 py-1 bg-[#ff3b30]/[0.08] text-[#ff3b30] text-[11px] font-semibold rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />Bias
                        </span>
                    ) : (
                        <span className="px-2.5 py-1 bg-[#34c759]/[0.08] text-[#34c759] text-[11px] font-semibold rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />Fair
                        </span>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}

function ScoreGauge({ score, severity }: { score: number; severity: string }) {
    const color = severity === "Critical" ? "from-[#ff3b30] to-[#ff6961]" : severity === "High" ? "from-[#ff9500] to-[#ffcc00]" : "from-[#34c759] to-[#32ade6]";
    const textColor = severity === "Critical" ? "text-[#ff3b30]" : severity === "High" ? "text-[#ff9500]" : "text-[#34c759]";
    return (
        <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-secondary)" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="url(#gaugeGrad)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * 264} 264`} />
                    <defs><linearGradient id="gaugeGrad"><stop offset="0%" stopColor="#ff3b30" /><stop offset="100%" stopColor="#32ade6" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold bg-gradient-to-b ${color} bg-clip-text text-transparent`}>{score}</span>
                </div>
            </div>
            <div>
                <p className={`text-xl font-bold ${textColor}`}>{severity}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Forensics Score</p>
            </div>
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (mode === "csv" && candidates.length < 5) { alert("Need at least 5 candidates"); return; }
        if (mode === "pdf" && totalFiles < 2) { alert("Upload at least 1 selected & 1 rejected resume"); return; }

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error);
            if (axios.isAxiosError(error) && error.response?.status === 401) { logout(); return; }
            alert(error.response?.data?.detail || "Analysis failed");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <main className="min-h-screen font-sans" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

                {/* Header */}
                <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push("/dashboard")} className="text-sm font-medium flex items-center gap-1.5 hover:underline" style={{ color: "var(--accent)" }}>
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <div>
                            <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.03em] gradient-text">Resume Forensics</h1>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Hiring Bias Detection for Indian IT</p>
                        </div>
                    </div>
                    <div className="px-4 py-2 rounded-xl flex items-center gap-2" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderColor: "rgba(0,113,227,0.15)" }}>
                        <Zap className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                        <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>6 Modules · 50 Batch Limit</span>
                    </div>
                </div>

                {/* Upload Card */}
                <div className="rounded-2xl overflow-hidden mb-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                    <div className="p-5 sm:p-8">
                        <h2 className="text-lg font-semibold mb-5">Upload Mode</h2>

                        {/* Mode Tabs */}
                        <div className="flex gap-2 mb-6">
                            {[
                                { m: "pdf" as const, icon: FileText, label: "PDF Resumes" },
                                { m: "csv" as const, icon: FileText, label: "CSV Data" },
                            ].map(({ m, icon: Icon, label }) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={cn(
                                        "px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                                        mode === m ? "text-white" : ""
                                    )}
                                    style={{
                                        background: mode === m ? "var(--accent)" : "var(--bg-secondary)",
                                        color: mode === m ? "#fff" : "var(--text-secondary)",
                                        border: mode === m ? "none" : "1px solid var(--border-primary)",
                                    }}
                                >
                                    <Icon className="w-4 h-4" /> {label}
                                </button>
                            ))}
                        </div>

                        {mode === "pdf" ? (
                            <div className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-5">
                                    {/* Selected */}
                                    <div className="p-5 rounded-2xl border-2 border-dashed border-[#34c759]/30 bg-[#34c759]/[0.02]">
                                        <UsersIcon className="w-7 h-7 text-[#34c759] mb-3" />
                                        <h3 className="text-base font-semibold text-[#34c759] mb-2 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" /> Selected Resumes
                                        </h3>
                                        <input type="file" accept=".pdf,.txt" multiple onChange={(e) => handlePDFUpload(e, "selected")} className="hidden" id="sel" />
                                        <label htmlFor="sel" className="block px-4 py-2 bg-[#34c759] text-white rounded-xl cursor-pointer text-center text-sm font-medium hover:bg-[#2db84e] transition-all">
                                            <Upload className="w-4 h-4 inline mr-2" />Upload ({selectedFiles.length}/50)
                                        </label>
                                        {selectedFiles.map((f, i) => (
                                            <div key={i} className="mt-2 flex items-center justify-between text-sm px-3 py-2 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                                                <span className="text-[#34c759] truncate text-xs">{f.name}</span>
                                                <button onClick={() => removeFile("selected", i)} className="text-[#ff3b30] hover:text-[#ff6961] text-xs">×</button>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Rejected */}
                                    <div className="p-5 rounded-2xl border-2 border-dashed border-[#ff3b30]/30 bg-[#ff3b30]/[0.02]">
                                        <UsersIcon className="w-7 h-7 text-[#ff3b30] mb-3" />
                                        <h3 className="text-base font-semibold text-[#ff3b30] mb-2 flex items-center gap-2">
                                            <XCircle className="w-4 h-4" /> Rejected Resumes
                                        </h3>
                                        <input type="file" accept=".pdf,.txt" multiple onChange={(e) => handlePDFUpload(e, "rejected")} className="hidden" id="rej" />
                                        <label htmlFor="rej" className="block px-4 py-2 bg-[#ff3b30] text-white rounded-xl cursor-pointer text-center text-sm font-medium hover:bg-[#ff6961] transition-all">
                                            <Upload className="w-4 h-4 inline mr-2" />Upload ({rejectedFiles.length}/50)
                                        </label>
                                        {rejectedFiles.map((f, i) => (
                                            <div key={i} className="mt-2 flex items-center justify-between text-sm px-3 py-2 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                                                <span className="text-[#ff3b30] truncate text-xs">{f.name}</span>
                                                <button onClick={() => removeFile("rejected", i)} className="text-[#ff3b30] hover:text-[#ff6961] text-xs">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total: {totalFiles}/50 resumes · PDFs auto-parsed</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Upload CSV with columns: Name, Identity, Selected, Score, College, Skills, Notes</p>
                                <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" id="csv" />
                                <label htmlFor="csv" className="inline-block px-5 py-2.5 text-sm font-medium text-white rounded-xl cursor-pointer transition-all" style={{ background: "var(--accent)" }}>
                                    <Upload className="w-4 h-4 inline mr-2" />Choose CSV
                                </label>
                                {csvFile && <span className="ml-4 text-sm text-[#34c759] font-medium">{csvFile.name} ({candidates.length} candidates)</span>}
                            </div>
                        )}

                        {((mode === "pdf" && totalFiles >= 2) || (mode === "csv" && candidates.length >= 5)) && (
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="mt-6 px-7 py-3 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                                style={{ background: "#af52de" }}
                            >
                                {analyzing ? (
                                    <><span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full inline-block mr-2" />Analyzing...</>
                                ) : `Analyze ${mode === "pdf" ? totalFiles : candidates.length} Candidates`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Results */}
                {result && (
                    <div className="space-y-5 animate-fade-in-up">
                        {/* Summary */}
                        <div className="rounded-2xl overflow-hidden border-2" style={{ background: "var(--bg-card)", borderColor: "rgba(0,113,227,0.15)", boxShadow: "var(--shadow-card)" }}>
                            <div className="p-5 sm:p-8">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-4">
                                    <h2 className="text-xl font-bold">Summary</h2>
                                    <ScoreGauge score={result.forensics_score.overall_score} severity={result.forensics_score.severity} />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { l: "Total", v: result.total_candidates, c: "var(--text-primary)" },
                                        { l: "Selected", v: result.total_selected, c: "#34c759" },
                                        { l: "Rejected", v: result.total_rejected, c: "#ff3b30" },
                                        { l: "Modules Flagged", v: `${result.forensics_score.modules_flagged}/6`, c: "#ff9500" },
                                    ].map((s, i) => (
                                        <div key={i} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-secondary)" }}>
                                            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{s.l}</p>
                                            <p className="text-xl font-bold" style={{ color: s.c }}>{s.v}</p>
                                        </div>
                                    ))}
                                </div>
                                {result.forensics_score.key_findings?.length > 0 && (
                                    <div className="mt-6 p-4 bg-[#ff3b30]/[0.04] border-l-[3px] border-[#ff3b30] rounded-r-xl">
                                        <p className="text-[#ff3b30] font-semibold mb-2 flex items-center gap-1.5 text-sm"><AlertTriangle className="w-4 h-4" />Key Findings</p>
                                        <ul>{result.forensics_score.key_findings.map((f: string, i: number) => <li key={i} className="text-[#ff3b30]/80 text-sm">• {f}</li>)}</ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <ModuleCard icon={Brain} title="Qualification-Controlled Bias" description="Equalized odds analysis" biasDetected={result.qualification_controlled_bias.bias_detected} color="bg-[#af52de]/[0.12] text-[#af52de]">
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{result.qualification_controlled_bias.note || "Analysis complete"}</p>
                        </ModuleCard>

                        <ModuleCard icon={Fingerprint} title="Name-Proxy Bias" description="Surname-community correlation" biasDetected={result.name_proxy_analysis.bias_detected} color="bg-[#ff9500]/[0.12] text-[#ff9500]">
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{result.name_proxy_analysis.note || `Max disparity: ${((result.name_proxy_analysis.max_disparity || 0) * 100).toFixed(1)}%`}</p>
                        </ModuleCard>

                        <ModuleCard icon={GraduationCap} title="College Pedigree Bias" description="IIT/NIT preference detection" biasDetected={result.college_pedigree_analysis.bias_detected} color="bg-[#32ade6]/[0.12] text-[#32ade6]">
                            {result.college_pedigree_analysis.pedigree_premium && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Tier-1 selected at <strong>{result.college_pedigree_analysis.pedigree_premium}x</strong> rate vs Tier-3</p>}
                        </ModuleCard>

                        <ModuleCard icon={MessageSquare} title="Language Disparity" description="Interviewer note sentiment" biasDetected={result.language_disparity.bias_detected} color="bg-[#ff3b30]/[0.12] text-[#ff3b30]">
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{result.language_disparity.coded_bias_detected?.length || 0} coded bias terms found</p>
                        </ModuleCard>

                        <ModuleCard icon={Target} title="Skill-Outcome Mismatch" description="Score threshold disparity" biasDetected={result.skill_outcome_mismatch.bias_detected} color="bg-[#0071e3]/[0.12] text-[#0071e3]">
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{result.skill_outcome_mismatch.finding || "No threshold disparity"}</p>
                        </ModuleCard>

                        <ModuleCard icon={Clock} title="Experience Penalty" description="Experience correlation check" biasDetected={result.experience_penalty.bias_detected} color="bg-[#34c759]/[0.12] text-[#34c759]">
                            {result.experience_penalty.experience_selection_correlation !== undefined && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Correlation: {result.experience_penalty.experience_selection_correlation > 0 ? "+" : ""}{result.experience_penalty.experience_selection_correlation}</p>}
                        </ModuleCard>
                    </div>
                )}
            </div>
        </main>
    );
}
