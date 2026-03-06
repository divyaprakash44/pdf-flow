"use client";

import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
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
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Trash2, GripVertical } from "lucide-react";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PageItem {
  id: string;
  pageNumber: number;
  originalIndex: number;
}

interface SortablePageProps {
  item: PageItem;
  fileUrl: string;
  onRemove: (id: string) => void;
}

function SortablePage({ item, fileUrl, onRemove }: SortablePageProps) {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white dark:bg-dark-400 rounded-xl overflow-hidden border-2 transition-colors ${
        isDragging ? "border-primary-500 shadow-2xl" : "border-gray-200 dark:border-gray-800 hover:border-primary-400/50"
      }`}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-20"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded-md z-20 pointer-events-none">
        Page {item.originalIndex + 1}
      </div>

      <div className="w-full flex justify-center items-center bg-gray-100 dark:bg-dark-500 min-h-[250px] pointer-events-none select-none">
        <Document file={fileUrl} loading={<div className="animate-pulse w-full h-[250px] bg-gray-200 dark:bg-gray-800 rounded"></div>}>
          <Page 
            pageNumber={item.originalIndex + 1} 
            width={200}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-sm drop-shadow-sm"
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    const initialPages = Array.from({ length: numPages }, (_, i) => ({
      id: `page-${i}`,
      pageNumber: i + 1,
      originalIndex: i,
    }));
    setPages(initialPages);
    onPagesChange(initialPages.map(p => p.originalIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);
        
        onPagesChange(newArray.map(p => p.originalIndex));
        return newArray;
      });
    }
  };

  const handleRemove = (id: string) => {
    setPages((items) => {
      const newArray = items.filter((item) => item.id !== id);
      onPagesChange(newArray.map(p => p.originalIndex));
      return newArray;
    });
  };

  return (
    <div className="w-full mt-6 bg-gray-50 dark:bg-dark-500/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800/50">
      <div className="hidden">
        {/* Hidden Document just to get page count */}
        {fileUrl && (
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
            <Page pageNumber={1} />
          </Document>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          Page Organizer
          <span className="text-sm font-normal text-gray-500 bg-white dark:bg-dark-400 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-800">
            {pages.length} / {numPages} pages
          </span>
        </h3>
        <p className="text-sm text-gray-500">Drag to reorder, click trash to remove</p>
      </div>

      {pages.length === 0 ? (
        <div className="w-full py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-gray-500">All pages removed. Cannot process an empty document.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page) => (
                <SortablePage
                  key={page.id}
                  item={page}
                  fileUrl={fileUrl}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
