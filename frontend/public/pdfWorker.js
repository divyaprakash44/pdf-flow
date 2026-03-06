import { PDFDocument } from 'pdf-lib';

/**
 * Worker to offload heavy PDF lib tasks from the UI thread.
 */

self.addEventListener('message', async (e) => {
  const { type, payload, jobId } = e.data;

  try {
    switch (type) {
      case 'MERGE_PDFS':
        const resultMerge = await handleMerge(payload.fileBuffers);
        self.postMessage({ type: 'SUCCESS', jobId, result: resultMerge });
        break;
      
      case 'APPLY_CHANGES':
        const resultApply = await handleApplyChanges(payload.fileBuffer, payload.selectedPages);
        self.postMessage({ type: 'SUCCESS', jobId, result: resultApply });
        break;
        
      default:
        self.postMessage({ type: 'ERROR', jobId, error: 'Unknown operation type' });
    }
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', jobId, error: error.message });
  }
});

async function handleMerge(fileBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  for (const buffer of fileBuffers) {
    const pdfDoc = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  return await mergedPdf.save();
}

async function handleApplyChanges(fileBuffer: ArrayBuffer, selectedPages: number[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const modifiedPdf = await PDFDocument.create();
  
  const copiedPages = await modifiedPdf.copyPages(pdfDoc, selectedPages);
  copiedPages.forEach((page) => modifiedPdf.addPage(page));

  return await modifiedPdf.save();
}
