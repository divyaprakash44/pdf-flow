"use client";

import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, GripVertical, Download } from "lucide-react";
import html2canvas from 'html2canvas';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PageItem {
  id: string;
  pageNumber: number;
  originalIndex: number;
}

interface SortablePageProps {
  item: PageItem;
  fileUrl: string;
  onRemove: (id: string, index: number) => void;
  isRendering: boolean;
}

function SortablePage({ item, fileUrl, onRemove, isRendering }: SortablePageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white dark:bg-dark-400 p-2 rounded-xl shadow-sm border ${
        isDragging
          ? "border-primary-500 shadow-xl"
          : "border-gray-100 dark:border-gray-800"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 bg-white/90 dark:bg-dark-500/90 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing backdrop-blur-sm"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div
        onClick={() => onRemove(item.id, item.originalIndex)}
        className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 dark:bg-dark-500/90 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 rounded-md shadow-sm border border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm"
      >
        <Trash2 className="w-4 h-4" />
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm pointer-events-none">
        Page {item.originalIndex + 1}
      </div>

      <div className={`overflow-hidden rounded-lg bg-gray-50 flex items-center justify-center pdf-page-container-${item.originalIndex} ${isRendering ? 'min-h-[200px]' : ''}`}>
        <Document file={fileUrl}>
          <Page
            pageNumber={item.originalIndex + 1}
            width={180}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-sm"
            loading={
              <div className="w-[180px] h-[250px] flex items-center justify-center">
                <div className="animate-pulse w-8 h-8 rounded-full bg-gray-200 dark:bg-dark-300" />
              </div>
            }
          />
        </Document>
      </div>
    </div>
  );
}

interface PdfGridProps {
  file: File;
  onPagesChange: (pages: number[]) => void;
}

export default function PdfGrid({ file, onPagesChange }: PdfGridProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before dragging starts (allows clicks on buttons)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setPages([]);
      setNumPages(0);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    // Parent component needs the 0-indexed original positions
    onPagesChange(pages.map((p) => p.originalIndex));
  }, [pages, onPagesChange]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    // Initialize pages array with IDs and their original indices (0-based)
    const initialPages = Array.from(new Array(numPages), (_, index) => ({
      id: `page-${index}`,
      pageNumber: index + 1,
      originalIndex: index,
    }));
    setPages(initialPages);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removePage = (idToRemove: string) => {
    setPages(pages.filter((page) => page.id !== idToRemove));
  };
  
  const exportAsImages = async () => {
    if (!gridRef.current || isExporting) return;
    setIsExporting(true);
    
    try {
      // Find all canvas elements rendered by react-pdf
      const canvases = gridRef.current.querySelectorAll('canvas');
      if (canvases.length === 0) {
        alert("No pages rendered yet to export.");
        setIsExporting(false);
        return;
      }
      
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      const imgFolder = zip.folder("pdf_pages");
      
      let count = 1;
      for (const canvas of Array.from(canvases)) {
        const imgData = canvas.toDataURL("image/png").split(',')[1];
        imgFolder?.file(`page_${count}.png`, imgData, {base64: true});
        count++;
      }
      
      const content = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(content);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Error exporting to images:", error);
      alert("Failed to export as images.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Page Layout
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag pages to reorder, or click the trash icon to remove them.
          </p>
        </div>
        
        {pages.length > 0 && (
          <button 
            onClick={exportAsImages}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-dark-500 dark:hover:bg-dark-400 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? "Zipping..." : "Export Images"}
          </button>
        )}
      </div>

      <div className="hidden">
        {/* Hidden document just to parse pages and get the count/trigger load success */}
        {fileUrl && (
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} />
        )}
      </div>

      {numPages > 0 && pages.length === 0 && (
        <div className="w-full py-12 text-center bg-gray-50 dark:bg-dark-500/50 rounded-2xl border border-gray-100 dark:border-gray-800/50">
          <p className="text-gray-500 dark:text-gray-400">
            All pages have been removed. Add more files to continue.
          </p>
        </div>
      )}

      {pages.length > 0 && fileUrl && (
        <div ref={gridRef}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {pages.map((page) => (
                  <SortablePage
                    key={page.id}
                    item={page}
                    fileUrl={fileUrl}
                    onRemove={removePage}
                    isRendering={true}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
