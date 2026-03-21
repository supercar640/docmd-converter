import JSZip from 'jszip';
import type { ConvertibleFile } from '@/types';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function downloadFiles(files: ConvertibleFile[]): Promise<void> {
  const completed = files.filter((f) => f.status === 'done' && f.result);
  if (completed.length === 0) return;

  if (completed.length === 1) {
    const file = completed[0];
    triggerDownload(file.result!, file.outputName);
    return;
  }

  const zip = new JSZip();
  for (const file of completed) {
    zip.file(file.outputName, file.result!);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `docmd-converted-${timestamp}.zip`;

  triggerDownload(blob, filename);
}
