'use client';

import type { ConvertibleFile } from '@/types';
import { formatFileSize } from '@/lib/fileHelpers';

interface FileRowProps {
  file: ConvertibleFile;
  onRemove: (id: string) => void;
}

const statusConfig = {
  pending: { color: 'bg-gray-100 text-gray-600', label: '대기' },
  converting: { color: 'bg-yellow-100 text-yellow-700', label: '변환중' },
  done: { color: 'bg-green-100 text-green-700', label: '완료' },
  error: { color: 'bg-red-100 text-red-700', label: '실패' },
};

export default function FileRow({ file, onRemove }: FileRowProps) {
  const status = statusConfig[file.status];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
        <p className="text-xs text-gray-400">
          {formatFileSize(file.originalFile.size)}
          {file.status === 'done' && (
            <span className="text-green-600"> → {file.outputName}</span>
          )}
        </p>
        {file.error && (
          <p className="text-xs text-red-500 mt-0.5">{file.error}</p>
        )}
      </div>

      {file.status === 'converting' && (
        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
        </div>
      )}

      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
      >
        {status.label}
      </span>

      <button
        onClick={() => onRemove(file.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
        aria-label="Remove file"
      >
        &times;
      </button>
    </div>
  );
}
