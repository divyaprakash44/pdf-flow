"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone, Accept } from "react-dropzone";
import { UploadCloud, File as FileIcon, Trash2, ArrowRight, Scissors, Eye, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import PDFObject from "pdfobject";
import dynamic from "next/dynamic";
import type { ToolMode } from "@/app/page";

const PdfGrid = dynamic(() => import("./PdfGrid"), { ssr: false });

export default function FileUploader({ mode }: { mode: ToolMode }) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageRange, setPageRange] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [targetSizeKB, setTargetSizeKB] = useState("");
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  useEffect(() => {
    if (previewFile && previewContainerRef.current) {
      const url = URL.createObjectURL(previewFile);
      PDFObject.embed(url, previewContainerRef.current, {
        height: "100%",
        width: "100%",
        fallbackLink: "<p>This browser does not support inline PDFs. Please download the PDF to view it.</p>"
      });
      return () => URL.revokeObjectURL(url);
    }
  }, [previewFile]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    if (acceptedFiles.length > 0) {
      setPageRange(""); // Reset text range on new drop
    }
  }, []);

  const handleApplyChanges = async () => {
    if (files.length !== 1) return;

    setIsProcessing(true);
    try {
      const file = files[0];
      
      // If it's not a PDF, send it to the backend for conversion
      if (file.type !== "application/pdf") {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("http://localhost:8000/convert/office-to-pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Server conversion failed: ${await response.text()}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `converted_${file.name.replace(/\.[^/.]+$/, "")}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setIsProcessing(false);
        return;
      }
      
      // Exact KB Compression
      if (mode === "compress" && targetSizeKB) {
        setIsProcessing(true);
        try {
          const targetBytes = parseFloat(targetSizeKB) * 1024;
          if (isNaN(targetBytes) || targetBytes <= 0) throw new Error("Invalid target size");

          const canvases = document.querySelectorAll('canvas.react-pdf__Page__canvas');
          if (canvases.length === 0) {
            alert("Please wait for all pages to render before compressing.");
            setIsProcessing(false);
            return;
          }

          let minQ = 0.05;
          let maxQ = 0.95;
          let bestBlob: Blob | null = null;
          
          for(let i = 0; i < 5; i++) {
             const midQ = (minQ + maxQ) / 2;
             const tempPdf = await PDFDocument.create();
             for (const canvas of Array.from(canvases)) {
                 const imgDataUrl = (canvas as HTMLCanvasElement).toDataURL('image/jpeg', midQ);
                 const base64Data = imgDataUrl.split(',')[1];
                 const binaryString = atob(base64Data);
                 const len = binaryString.length;
                 const imageBytes = new Uint8Array(len);
                 for (let j = 0; j < len; j++) {
                     imageBytes[j] = binaryString.charCodeAt(j);
                 }
                 const image = await tempPdf.embedJpg(imageBytes);
                 const page = tempPdf.addPage([image.width, image.height]);
                 page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
             }
             const bytes = await tempPdf.save();
             bestBlob = new Blob([bytes], { type: "application/pdf" });
             if (bytes.length > targetBytes) {
                maxQ = midQ;
             } else {
                minQ = midQ;
             }
          }
          
          if (bestBlob) {
            const url = URL.createObjectURL(bestBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `compressed_${file.name.replace(".pdf", "")}_${targetSizeKB}KB.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          console.error(err);
          alert("Compression failed.");
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Standard PDF manipulation
      if (selectedPages.length === 0) {
        setIsProcessing(false);
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      
      const worker = new Worker(new URL('../workers/pdfWorker.ts', import.meta.url));
      const jobId = Date.now().toString();

      worker.postMessage({
        type: 'APPLY_CHANGES',
        jobId,
        payload: { fileBuffer: arrayBuffer, selectedPages }
      });

      worker.onmessage = (e) => {
        if (e.data.jobId === jobId) {
          if (e.data.type === 'SUCCESS') {
            const blob = new Blob([new Uint8Array(e.data.result) as BlobPart], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement("a");
            link.href = url;
            link.download = `modified_${file.name.replace(".pdf", "")}_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } else if (e.data.type === 'ERROR') {
            console.error("Worker Error:", e.data.error);
            alert(`An error occurred: ${e.data.error}`);
          }
          setIsProcessing(false);
          worker.terminate();
        }
      };

    } catch (error) {
      console.error("Error modifying PDF:", error);
      alert("An error occurred while modifying the PDF.");
      setIsProcessing(false);
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    
    // Robust check for PDFs and Images regardless of missing Windows mimes
    const hasUnsupportedMerge = files.some(f => {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const isImg = f.type.startsWith("image/") || f.name.match(/\.(jpg|jpeg|png)$/i);
      return !isPdf && !isImg;
    });
    
    if (hasUnsupportedMerge) {
      alert("Please convert Office documents to PDF individually before merging.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      
      for (const file of files) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        
        if (isPdf) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        } else if (file.type.startsWith("image/") || file.name.match(/\.(jpg|jpeg|png)$/i)) {
          const arrayBuffer = await file.arrayBuffer();
          const imageBytes = new Uint8Array(arrayBuffer);
          let image;
          if (file.type === "image/jpeg" || file.type === "image/jpg" || file.name.match(/\.(jpg|jpeg)$/i)) {
            image = await mergedPdf.embedJpg(imageBytes);
          } else if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
            image = await mergedPdf.embedPng(imageBytes);
          } else {
            continue; // Unsupported image
          }
          
          const page = mergedPdf.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
        }
      }
      
      const mergedPdfFile = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfFile)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `merged_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("An error occurred while merging the files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getAcceptedTypes = (): Accept => {
    switch (mode) {
      case "compress":
      case "pdf-to-img":
      case "rearrange":
      case "pdf-to-word":
        return { "application/pdf": [".pdf"] };
      case "img-to-pdf":
        return { 
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"],
          "image/webp": [".webp"]
        };
      case "word-to-pdf":
        return {
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
          "application/msword": [".doc"],
        };
      case "merge":
        return {
          "application/pdf": [".pdf"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/png": [".png"]
        };
      default:
        return { "application/pdf": [".pdf"] };
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedTypes(),
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length - 1 < 2) setPageRange("");
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col gap-6">
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
          <h3 className="text-2xl font-semibold mb-2 capitalize">
            {isDragActive ? "Drop files here" : `Drag & drop to ${mode.replace(/-/g, ' ')}`}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            or click to browse from your device.
          </p>
        </div>
        <input {...getInputProps()} />
      </div>

      {files.length > 0 && (
        <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h4 className="text-lg font-medium">Selected Files ({files.length})</h4>
            
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
              <button 
                onClick={() => {
                  setFiles([]);
                  setPageRange("");
                }}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear all
              </button>

              {files.length === 1 ? (
                <button 
                  onClick={handleApplyChanges}
                  disabled={isProcessing || (files[0].type === "application/pdf" && selectedPages.length === 0 && mode !== "compress")}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-primary-500/20 transition-all font-medium cursor-pointer"
                >
                  {isProcessing ? "Processing..." : (mode === "compress" ? "Compress PDF" : (files[0].type !== "application/pdf" ? "Convert to PDF" : "Save Changes"))} 
                  {files[0].type !== "application/pdf" ? <ArrowRight className="w-4 h-4 ml-1" /> : <Scissors className="w-4 h-4 ml-1" />}
                </button>
              ) : (
                <button 
                  onClick={handleMerge}
                  disabled={isProcessing || files.length < 2}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-primary-500/20 transition-all font-medium cursor-pointer"
                >
                  {isProcessing ? "Merging..." : "Merge PDFs"} <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>
          </div>
          
          {files.length === 1 ? (
            <div className="w-full">
              <div 
                className="flex items-center justify-between p-4 bg-white dark:bg-dark-400 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                    <FileIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-medium truncate max-w-[200px] sm:max-w-md">{files[0].name}</h5>
                    <p className="text-xs text-gray-500">
                      {(files[0].size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {files[0].type === "application/pdf" && (
                  <button 
                    onClick={() => setPreviewFile(files[0])}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-dark-500 dark:hover:bg-dark-400 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                )}
              </div>
              
              {mode === "compress" && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-500/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between animate-in fade-in">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Target File Size (KB)</label>
                    <p className="text-xs text-gray-500">We will attempt to compress the PDF to match this size.</p>
                  </div>
                  <input 
                    type="number" 
                    min="1"
                    value={targetSizeKB}
                    onChange={(e) => setTargetSizeKB(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-32 px-3 py-2 bg-white dark:bg-dark-400 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              )}

              {/* PDF Grid Component */}
              {files[0].type === "application/pdf" ? (
                <PdfGrid 
                  file={files[0]} 
                  onPagesChange={setSelectedPages} 
                />
              ) : (
                <div className="w-full mt-6 py-12 text-center bg-gray-50 dark:bg-dark-500/50 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ready to convert</h3>
                  <p className="text-gray-500 dark:text-gray-400">Click &quot;Convert to PDF&quot; to securely process this Office document.</p>
                </div>
              )}
            </div>
          ) : (
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
                        setPreviewFile(file);
                      }}
                      className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Preview file"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
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
          )}
        </div>
      )}

      {/* Live Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-dark-500 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-dark-400/50">
              <div className="flex items-center gap-3">
                <FileIcon className="w-5 h-5 text-primary-500" />
                <h3 className="font-medium truncate max-w-[300px] sm:max-w-xl">{previewFile.name}</h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-dark-400 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-dark-400 w-full h-full relative" ref={previewContainerRef}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
