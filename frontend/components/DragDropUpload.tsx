
"use client";

import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, Loader2, Type, Plus, X, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './ui/card';
import { Button } from '@/components/ui/button';

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
                setFiles(prev => [...prev, ...newFiles].slice(0, 50)); // Limit to 50 files
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
            setFiles(prev => [...prev, ...newFiles].slice(0, 50)); // Limit to 50 files
        }
    };

    const removeFile = (idx: number) => {
        setFiles(files.filter((_, i) => i !== idx));
    }

    const addTextInput = () => {
        if (textInputs.length < 50) {
            setTextInputs([...textInputs, '']);
        }
    };

    const removeTextInput = (idx: number) => {
        if (textInputs.length > 1) {
            setTextInputs(textInputs.filter((_, i) => i !== idx));
        }
    };

    const updateTextInput = (idx: number, value: string) => {
        const updated = [...textInputs];
        updated[idx] = value;
        setTextInputs(updated);
    };

    const handleAnalyze = () => {
        const validTexts = textInputs.filter(t => t.trim().length > 0);
        onUpload(files, validTexts);
    }

    const totalItems = files.length + textInputs.filter(t => t.trim()).length;

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex space-x-2">
                <Button
                    variant={activeTab === "file" ? "default" : "outline"}
                    onClick={() => setActiveTab("file")}
                    className={cn(activeTab === "file" ? "bg-indigo-600 border-transparent text-white" : "border-slate-700 text-slate-400 bg-transparent hover:bg-slate-800")}
                >
                    <UploadCloud className="w-4 h-4 mr-2" /> Upload Files
                    {files.length > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded">{files.length}</span>}
                </Button>
                <Button
                    variant={activeTab === "text" ? "default" : "outline"}
                    onClick={() => setActiveTab("text")}
                    className={cn(activeTab === "text" ? "bg-indigo-600 border-transparent text-white" : "border-slate-700 text-slate-400 bg-transparent hover:bg-slate-800")}
                >
                    <Type className="w-4 h-4 mr-2" /> Multiple Texts
                    {textInputs.filter(t => t.trim()).length > 0 && <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded">{textInputs.filter(t => t.trim()).length}</span>}
                </Button>
            </div>

            {activeTab === "file" && (
                <Card
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-xl transition-all cursor-pointer group overflow-hidden p-6",
                        isDragging ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50",
                        "glass-panel"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf,.csv,.txt"
                        multiple
                        onChange={handleFileChange}
                    />

                    <div className="flex flex-col items-center w-full" onClick={(e) => {
                        // Prevent click when removing individual files
                        if ((e.target as HTMLElement).closest('.remove-btn')) return;
                        document.getElementById('file-upload')?.click();
                    }}>
                        {files.length === 0 ? (
                            <>
                                <UploadCloud className="w-12 h-12 text-slate-500 mb-4 group-hover:text-indigo-400 transition-colors" />
                                <p className="text-lg font-medium text-slate-300">Drop PDFs or CSVs here</p>
                                <p className="text-sm text-slate-500 mt-2">or click to browse (up to 50 files)</p>
                            </>
                        ) : (
                            <div className="w-full space-y-2">
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
                                    <span className="text-sm text-slate-400 flex items-center">
                                        <List className="w-4 h-4 mr-2" />
                                        {files.length} file{files.length !== 1 ? 's' : ''} selected
                                    </span>
                                    <span className="text-xs text-slate-600">{50 - files.length} remaining</span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-800/80 p-3 rounded border border-slate-700">
                                            <div className="flex items-center truncate">
                                                <FileText className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0" />
                                                <span className="text-sm text-slate-200 truncate max-w-[200px]">{f.name}</span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                                className="remove-btn text-slate-500 hover:text-red-400 text-xs px-2 py-1"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {files.length < 50 && (
                                    <p className="text-xs text-center text-slate-500 mt-4 pt-2 border-t border-slate-700/50">Click area to add more</p>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {activeTab === "text" && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400 flex items-center">
                            <List className="w-4 h-4 mr-2" />
                            {textInputs.filter(t => t.trim()).length} text{textInputs.filter(t => t.trim()).length !== 1 ? 's' : ''} entered
                        </span>
                        <span className="text-xs text-slate-600">{50 - textInputs.length} remaining</span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                        {textInputs.map((text, idx) => (
                            <div key={idx} className="relative group">
                                <div className="flex items-start gap-2">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-mono mt-2">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <textarea
                                            className="w-full h-[100px] p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 resize-none glass-panel placeholder:text-slate-600 text-sm"
                                            placeholder={`Text ${idx + 1}: Paste content here (e.g., job description, email, article)...`}
                                            value={text}
                                            onChange={(e) => updateTextInput(idx, e.target.value)}
                                        />
                                    </div>
                                    {textInputs.length > 1 && (
                                        <button
                                            onClick={() => removeTextInput(idx)}
                                            className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors mt-2"
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
                        <Button
                            onClick={addTextInput}
                            variant="outline"
                            className="w-full border-dashed border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 hover:border-indigo-500/50"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Another Text (Max 50)
                        </Button>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <div className="text-sm text-slate-400">
                    <span className="font-semibold text-white">{totalItems}</span> item{totalItems !== 1 ? 's' : ''} ready for analysis
                </div>
                <Button
                    onClick={handleAnalyze}
                    disabled={isUploading || totalItems === 0}
                    className="h-12 px-8 text-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-0 shadow-lg shadow-indigo-500/20"
                >
                    {isUploading ? (
                        <span className="flex items-center">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing {totalItems} Item{totalItems !== 1 ? 's' : ''}...
                        </span>
                    ) : `Run Bias Audit on ${totalItems} Item${totalItems !== 1 ? 's' : ''}`}
                </Button>
            </div>
        </div>
    );
};

