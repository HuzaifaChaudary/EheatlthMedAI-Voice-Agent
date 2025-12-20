"use client";

import React, { useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import { Upload, X, File, CheckCircle } from 'lucide-react';

interface FileUploadProps {
    onUpload: (file: File) => Promise<void>;
    accept?: string;
    maxSizeMB?: number;
    className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    onUpload,
    accept = "*",
    maxSizeMB = 5,
    className,
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateFile = (file: File) => {
        if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
            setError(`File size exceeds ${maxSizeMB}MB limit.`);
            return false;
        }
        return true;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (validateFile(droppedFile)) {
                setFile(droppedFile);
                setError(null);
                setSuccess(false);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (validateFile(selectedFile)) {
                setFile(selectedFile);
                setError(null);
                setSuccess(false);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            await onUpload(file);
            setSuccess(true);
            setFile(null);
            if (inputRef.current) inputRef.current.value = '';
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setError(null);
        setSuccess(false);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className={cn("w-full", className)}>
            <div
                className={cn(
                    "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600 transition-colors",
                    dragActive ? "border-primary bg-primary/10" : "border-gray-300",
                    error ? "border-destructive bg-destructive/10" : ""
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && inputRef.current?.click()}
            >
                {file ? (
                    <div className="flex flex-col items-center p-4 text-center cursor-default" onClick={(e) => e.stopPropagation()}>
                        <File className="w-10 h-10 mb-3 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 font-semibold">{file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                        <div className="flex space-x-2 mt-4">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={clearFile}
                                disabled={uploading}
                            >
                                Remove
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={uploading}
                                loading={uploading}
                            >
                                Upload
                            </Button>
                        </div>
                    </div>
                ) : success ? (
                    <div className="flex flex-col items-center p-4 text-center">
                        <CheckCircle className="w-10 h-10 mb-3 text-green-500" />
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 font-semibold">Upload Successful!</p>
                        <Button variant="outline" size="sm" onClick={() => setSuccess(false)}>Upload Another</Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {accept === '*' ? 'Any file' : accept} (MAX. {maxSizeMB}MB)
                        </p>
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    onChange={handleChange}
                />
            </div>

            {error && (
                <p className="mt-2 text-sm text-destructive font-medium text-center">{error}</p>
            )}
        </div>
    );
};
