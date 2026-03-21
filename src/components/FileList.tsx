'use client';

import type { ConvertibleFile } from '@/types';
import FileRow from './FileRow';

interface FileListProps {
  files: ConvertibleFile[];
  onRemove: (id: string) => void;
}

export default function FileList({ files, onRemove }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      {files.map((file) => (
        <FileRow key={file.id} file={file} onRemove={onRemove} />
      ))}
    </div>
  );
}
