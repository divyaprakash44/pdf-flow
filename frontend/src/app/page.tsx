import FileUploader from "@/components/FileUploader";
import { Layers } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-600/10 blur-[120px] pointer-events-none" />
      
      <main className="relative z-10 flex flex-col items-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 min-h-screen">
        <header className="mb-16 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary-500/10 rounded-2xl mb-6">
            <Layers className="w-10 h-10 text-primary-500" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            PDF Flow
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Fast, secure, and private PDF manipulation. Merge, split, compress, and convert documents entirely within your browser. Zero file retention.
          </p>
        </header>

        <FileUploader />
      </main>
    </div>
  );
}
