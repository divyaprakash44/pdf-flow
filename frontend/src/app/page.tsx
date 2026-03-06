"use client";

import { useState, useEffect } from "react";
import FileUploader from "@/components/FileUploader";
import { Layers, FileOutput, FileImage, FileText, Minimize2, BringToFront, SplitSquareHorizontal } from "lucide-react";

export type ToolMode = 
  | "compress"
  | "img-to-pdf"
  | "pdf-to-img"
  | "word-to-pdf"
  | "pdf-to-word"
  | "merge"
  | "rearrange";

const tools = [
  { id: "merge", name: "Merge PDF", description: "Combine multiple PDFs into one unified document.", icon: Layers, color: "bg-blue-500/10 text-blue-600" },
  { id: "rearrange", name: "Rearrange/Split PDF", description: "Sort, delete, or extract pages from your PDF.", icon: SplitSquareHorizontal, color: "bg-purple-500/10 text-purple-600" },
  { id: "compress", name: "Compress PDF", description: "Reduce file size without losing quality.", icon: Minimize2, color: "bg-green-500/10 text-green-600" },
  { id: "img-to-pdf", name: "Image to PDF", description: "Convert JPG, PNG, or WebP images to PDF.", icon: FileImage, color: "bg-yellow-500/10 text-yellow-600" },
  { id: "pdf-to-img", name: "PDF to JPG/PNG", description: "Extract pages as high-quality images.", icon: FileImage, color: "bg-orange-500/10 text-orange-600" },
  { id: "word-to-pdf", name: "Word to PDF", description: "Convert DOC and DOCX files into PDF.", icon: FileText, color: "bg-blue-500/10 text-blue-600" },
  { id: "pdf-to-word", name: "PDF to Word", description: "Convert PDF documents back to editable Word formats.", icon: FileOutput, color: "bg-red-500/10 text-red-600" },
] as const;

export default function Home() {
  const [selectedTool, setSelectedTool] = useState<ToolMode | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "") as ToolMode | "";
      if (hash && tools.some((t) => t.id === hash)) {
        setSelectedTool(hash as ToolMode);
      } else {
        setSelectedTool(null);
      }
    };

    handleHashChange(); // Check hash on mount
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const selectTool = (toolId: ToolMode | null) => {
    if (toolId) {
      window.location.hash = toolId;
    } else {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
      setSelectedTool(null);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-600/10 blur-[120px] pointer-events-none" />
      
      <main className="relative z-10 flex flex-col items-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 min-h-screen">
        <header className="mb-16 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary-500/10 rounded-2xl mb-6 shadow-sm">
            <Layers className="w-10 h-10 text-primary-500" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            PDF Flow
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Fast, secure, and private PDF manipulation. Zero file retention.
          </p>
        </header>

        {!selectedTool ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => selectTool(tool.id as ToolMode)}
                  className="group relative bg-white dark:bg-dark-400 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:border-primary-500/30 transition-all duration-300 text-left flex flex-col h-full cursor-pointer hover:-translate-y-1"
                >
                  <div className={`p-4 rounded-xl ${tool.color} w-max mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    {tool.name}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                    {tool.description}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            {/* Sticky Back Button for easy access */}
            <div className="w-full max-w-5xl mx-auto flex justify-start sticky top-4 z-50 mb-4 px-4">
              <button
                onClick={() => selectTool(null)}
                className="text-primary-600 hover:text-primary-500 font-medium flex items-center gap-2 hover:-translate-x-1 transition-transform bg-white/90 dark:bg-dark-500/90 backdrop-blur-md px-4 py-2 rounded-full cursor-pointer shadow-xl border border-gray-200 dark:border-gray-700"
              >
                &larr; Back to Tools
              </button>
            </div>
            
            <div className="text-center mb-8 px-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white capitalize">
                {tools.find(t => t.id === selectedTool)?.name}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {tools.find(t => t.id === selectedTool)?.description}
              </p>
            </div>

            <FileUploader mode={selectedTool} />
            
            {/* Footer Back Button */}
            <div className="mt-8 mb-12">
              <button
                onClick={() => selectTool(null)}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
              >
                Return to Tool Selection
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
