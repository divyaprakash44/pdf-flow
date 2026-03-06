"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, File as FileIcon, Trash2, ArrowRight } from "lucide-react";

export default function FileUploader() {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-6">
      <div
        {...getRootProps()}
        className={`relative w-full p-12 overflow-hidden border-2 border-dashed rounded-3xl transition-all duration-300 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4 group
        ${
          isDragActive
            ? "border-primary-500 bg-primary-500/10 scale-[1.02]"
            : "border-gray-300 dark:border-gray-800 hover:border-primary-500/50 hover:bg-black/5 dark:hover:bg-white/5"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className={`p-4 rounded-full bg-primary-500/10 text-primary-500 mb-2 transition-transform duration-300 ${isDragActive ? 'scale-110' : 'group-hover:scale-110'}`}>
          <UploadCloud className="w-10 h-10" />
        </div>
        
        <div className="text-center z-10">
          <h3 className="text-2xl font-semibold mb-2">
            {isDragActive ? "Drop PDFs here" : "Drag & drop PDFs here"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            or click to browse from your device
          </p>
        </div>
        <input {...getInputProps()} />
      </div>

      {files.length > 0 && (
        <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium">Selected Files ({files.length})</h4>
            <div className="flex gap-3">
              <button 
                onClick={() => setFiles([])}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear all
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl shadow-lg shadow-primary-500/20 transition-all font-medium cursor-pointer">
                Merge PDFs <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid gap-3">
            {files.map((file, i) => (
              <div 
                key={`${file.name}-${i}`} 
                className="flex items-center justify-between p-4 bg-white dark:bg-dark-400 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                    <FileIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-medium truncate max-w-[200px] sm:max-w-md">{file.name}</h5>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
