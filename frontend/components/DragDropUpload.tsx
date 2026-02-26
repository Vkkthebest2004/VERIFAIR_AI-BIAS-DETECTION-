"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
    onUpload: (files: File[], textInputs: string[]) => void;
    isUploading: boolean;
}

export const DragDropUpload: React.FC<DragDropUploadProps> = ({ onUpload, isUploading }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [textInputs, setTextInputs] = useState<string[]>(['']);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState<'files' | 'text'>('files');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
            f.type === 'application/pdf' || f.type === 'text/csv' || f.type === 'text/plain' ||
            f.name.endsWith('.csv') || f.name.endsWith('.txt') || f.name.endsWith('.pdf')
        );
        setFiles(prev => [...prev, ...droppedFiles]);
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

    const addTextInput = () => setTextInputs(prev => [...prev, '']);
    const removeTextInput = (idx: number) => setTextInputs(prev => prev.filter((_, i) => i !== idx));
    const updateTextInput = (idx: number, val: string) =>
        setTextInputs(prev => prev.map((t, i) => (i === idx ? val : t)));

    const canAnalyze = files.length > 0 || textInputs.some(t => t.trim());

    const handleAnalyze = () => {
        if (!canAnalyze || isUploading) return;
        onUpload(files, textInputs.filter(t => t.trim()));
    };

    return (
        <div className="space-y-5">
            {/* Tab Switcher */}
            <div className="flex gap-2">
                {[
                    { key: 'files' as const, label: 'Upload Files', icon: Upload },
                    { key: 'text' as const, label: 'Paste Text', icon: FileText },
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                        )}
                        style={{
                            background: activeTab === key ? "var(--accent)" : "var(--bg-secondary)",
                            color: activeTab === key ? "#fff" : "var(--text-secondary)",
                            border: activeTab === key ? "none" : "1px solid var(--border-primary)",
                        }}
                    >
                        <Icon className="w-4 h-4" /> {label}
                    </button>
                ))}
            </div>

            {activeTab === 'files' ? (
                <>
                    {/* Drop Zone */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "relative rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all",
                            isDragging ? "border-[var(--accent)] bg-[var(--accent)]/[0.02]" : "border-[var(--border-primary)] hover:border-[var(--accent)]/30"
                        )}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.csv,.txt"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                            <Upload className="w-5 h-5" style={{ color: "var(--accent)" }} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Drop files here, or <span style={{ color: "var(--accent)" }}>browse</span>
                        </p>
                        <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                            PDF, CSV, TXT • Multiple files supported
                        </p>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            {files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{file.name}</p>
                                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="p-1.5 rounded-lg transition-all hover:bg-[#ff3b30]/10">
                                        <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* Text Inputs */}
                    <div className="space-y-3">
                        {textInputs.map((text, idx) => (
                            <div key={idx} className="relative">
                                <textarea
                                    value={text}
                                    onChange={(e) => updateTextInput(idx, e.target.value)}
                                    placeholder={`Paste text for analysis (input ${idx + 1})...`}
                                    className="w-full min-h-[120px] p-4 text-sm rounded-xl resize-y outline-none transition-all"
                                    style={{
                                        background: "var(--bg-secondary)",
                                        border: "1px solid var(--border-primary)",
                                        color: "var(--text-primary)",
                                    }}
                                />
                                {textInputs.length > 1 && (
                                    <button
                                        onClick={() => removeTextInput(idx)}
                                        className="absolute top-3 right-3 p-1.5 rounded-lg transition-all hover:bg-[#ff3b30]/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-[#ff3b30]" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={addTextInput}
                        className="flex items-center gap-2 text-sm font-medium transition-all hover:opacity-80"
                        style={{ color: "var(--accent)" }}
                    >
                        <Plus className="w-4 h-4" /> Add another text input
                    </button>
                </>
            )}

            {/* Analyze Button */}
            <button
                onClick={handleAnalyze}
                disabled={!canAnalyze || isUploading}
                className="w-full py-3.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "var(--accent)" }}
            >
                {isUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                ) : (
                    <>Analyze {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Text'}</>
                )}
            </button>
        </div>
    );
};
