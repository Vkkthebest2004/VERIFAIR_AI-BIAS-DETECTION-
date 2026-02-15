
"use client";

import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, Loader2, Type, Plus, X, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
    onUpload: (files: File[], texts: string[]) => void;
    isUploading: boolean;
}

export const DragDropUpload: React.FC<DragDropUploadProps> = ({ onUpload, isUploading }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [textInputs, setTextInputs] = useState<string[]>(['']);
    const [activeTab, setActiveTab] = useState<"file" | "text">("file");

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files).filter(f =>
                f.type === 'application/pdf' || f.type === 'text/csv' || f.type === 'text/plain' ||
                f.name.endsWith('.csv') || f.name.endsWith('.txt')
            );
            if (newFiles.length > 0) {
                setFiles(prev => [...prev, ...newFiles].slice(0, 50));
                setActiveTab("file");
            } else {
                alert("Only PDF, CSV, and TXT files are supported!");
            }
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).filter(f =>
                f.type === 'application/pdf' || f.type === 'text/csv' || f.type === 'text/plain' ||
                f.name.endsWith('.csv') || f.name.endsWith('.txt')
            );
            setFiles(prev => [...prev, ...newFiles].slice(0, 50));
        }
    };

    const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

    const addTextInput = () => {
        if (textInputs.length < 50) setTextInputs([...textInputs, '']);
    };

    const removeTextInput = (idx: number) => {
        if (textInputs.length > 1) setTextInputs(textInputs.filter((_, i) => i !== idx));
    };

    const updateTextInput = (idx: number, value: string) => {
        const updated = [...textInputs];
        updated[idx] = value;
        setTextInputs(updated);
    };

    const handleAnalyze = () => {
        const validTexts = textInputs.filter(t => t.trim().length > 0);
        onUpload(files, validTexts);
    };

    const totalItems = files.length + textInputs.filter(t => t.trim()).length;

    return (
        <div className="space-y-5">
            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("file")}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        activeTab === "file"
                            ? "text-white shadow-lg shadow-indigo-500/20"
                            : "hover:opacity-80"
                    )}
                    style={{
                        background: activeTab === "file" ? "var(--btn-primary-bg)" : "var(--bg-card-hover)",
                        border: `1px solid ${activeTab === "file" ? "transparent" : "var(--border-secondary)"}`,
                        color: activeTab === "file" ? "white" : "var(--text-secondary)",
                    }}
                >
                    <UploadCloud className="w-4 h-4" /> Upload Files
                    {files.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[11px] rounded-md bg-white/20">{files.length}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("text")}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        activeTab === "text"
                            ? "text-white shadow-lg shadow-indigo-500/20"
                            : "hover:opacity-80"
                    )}
                    style={{
                        background: activeTab === "text" ? "var(--btn-primary-bg)" : "var(--bg-card-hover)",
                        border: `1px solid ${activeTab === "text" ? "transparent" : "var(--border-secondary)"}`,
                        color: activeTab === "text" ? "white" : "var(--text-secondary)",
                    }}
                >
                    <Type className="w-4 h-4" /> Multiple Texts
                    {textInputs.filter(t => t.trim()).length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[11px] rounded-md bg-white/20">{textInputs.filter(t => t.trim()).length}</span>
                    )}
                </button>
            </div>

            {/* File Upload */}
            {activeTab === "file" && (
                <div
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-2xl transition-all cursor-pointer group overflow-hidden p-6",
                    )}
                    style={{
                        borderColor: isDragging ? "var(--drag-border-active)" : "var(--drag-border)",
                        background: isDragging ? "var(--drag-bg-active)" : "transparent",
                    }}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input id="file-upload" type="file" className="hidden" accept=".pdf,.csv,.txt" multiple onChange={handleFileChange} />

                    <div className="flex flex-col items-center w-full" onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.remove-btn')) return;
                        document.getElementById('file-upload')?.click();
                    }}>
                        {files.length === 0 ? (
                            <>
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: "var(--accent-glow)" }}>
                                    <UploadCloud className="w-8 h-8" style={{ color: "var(--accent-primary)" }} />
                                </div>
                                <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                                    Drop files here
                                </p>
                                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                                    PDF, CSV, or TXT files — up to 50
                                </p>
                            </>
                        ) : (
                            <div className="w-full space-y-2">
                                <div className="flex items-center justify-between mb-3 pb-3"
                                    style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                                    <span className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                                        <List className="w-4 h-4" />
                                        {files.length} file{files.length !== 1 ? 's' : ''} selected
                                    </span>
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{50 - files.length} remaining</span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl transition-all"
                                            style={{
                                                background: "var(--file-item-bg)",
                                                border: "1px solid var(--file-item-border)",
                                            }}>
                                            <div className="flex items-center truncate gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                    style={{ background: "var(--accent-glow)" }}>
                                                    <FileText className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
                                                </div>
                                                <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                                className="remove-btn text-xs px-2.5 py-1 rounded-lg font-medium transition-all hover:scale-105"
                                                style={{ color: "var(--text-muted)" }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.color = "#ef4444";
                                                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.color = "var(--text-muted)";
                                                    e.currentTarget.style.background = "transparent";
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {files.length < 50 && (
                                    <p className="text-xs text-center mt-4 pt-3" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-secondary)" }}>
                                        Click area to add more files
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Text Input */}
            {activeTab === "text" && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                            <List className="w-4 h-4" />
                            {textInputs.filter(t => t.trim()).length} text{textInputs.filter(t => t.trim()).length !== 1 ? 's' : ''} entered
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{50 - textInputs.length} remaining</span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                        {textInputs.map((text, idx) => (
                            <div key={idx} className="relative group">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold mt-2"
                                        style={{
                                            background: "var(--accent-glow)",
                                            color: "var(--accent-primary)",
                                            border: "1px solid var(--accent-glow)",
                                        }}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <textarea
                                            className="w-full h-[100px] p-4 rounded-xl outline-none resize-none text-sm transition-all"
                                            style={{
                                                background: "var(--textarea-bg)",
                                                border: "1px solid var(--border-secondary)",
                                                color: "var(--text-primary)",
                                            }}
                                            placeholder={`Text ${idx + 1}: Paste content here (e.g., job description, email, article)...`}
                                            value={text}
                                            onChange={(e) => updateTextInput(idx, e.target.value)}
                                        />
                                    </div>
                                    {textInputs.length > 1 && (
                                        <button
                                            onClick={() => removeTextInput(idx)}
                                            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 mt-2"
                                            style={{
                                                background: "rgba(239,68,68,0.1)",
                                                border: "1px solid rgba(239,68,68,0.2)",
                                                color: "#ef4444",
                                            }}
                                            title="Remove this text"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {textInputs.length < 50 && (
                        <button
                            onClick={addTextInput}
                            className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                            style={{
                                borderColor: "var(--drag-border)",
                                color: "var(--text-muted)",
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = "var(--accent-primary)";
                                e.currentTarget.style.color = "var(--accent-primary)";
                                e.currentTarget.style.background = "var(--accent-glow)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "var(--drag-border)";
                                e.currentTarget.style.color = "var(--text-muted)";
                                e.currentTarget.style.background = "transparent";
                            }}
                        >
                            <Plus className="w-4 h-4" /> Add Another Text (Max 50)
                        </button>
                    )}
                </div>
            )}

            {/* Status Bar + Analyze */}
            <div className="flex items-center justify-between p-4 rounded-2xl"
                style={{
                    background: "var(--status-bar-bg)",
                    border: "1px solid var(--status-bar-border)",
                }}>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>{totalItems}</span> item{totalItems !== 1 ? 's' : ''} ready for analysis
                </div>
                <button
                    onClick={handleAnalyze}
                    disabled={isUploading || totalItems === 0}
                    className="h-12 px-8 text-sm font-bold rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                        background: "var(--btn-primary-bg)",
                        boxShadow: "0 4px 15px -3px rgba(79, 70, 229, 0.4)",
                    }}
                >
                    {isUploading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Analyzing {totalItems} Item{totalItems !== 1 ? 's' : ''}...
                        </span>
                    ) : `Run Bias Audit on ${totalItems} Item${totalItems !== 1 ? 's' : ''}`}
                </button>
            </div>
        </div>
    );
};
