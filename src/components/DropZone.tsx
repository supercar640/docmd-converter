'use client';

import { useCallback, useRef, useState } from 'react';
import type { ConversionMode } from '@/types';
import { MAX_FILES } from '@/types';

interface DropZoneProps {
  mode: ConversionMode;
  currentCount: number;
  disabled: boolean;
  onFilesAdded: (files: File[]) => void;
}

export default function DropZone({ mode, currentCount, disabled, onFilesAdded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [warning, setWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = mode === 'docx-to-md' ? '.docx' : '.md,.markdown,.txt';
  const label = mode === 'docx-to-md' ? '.docx' : '.md';
  const remaining = MAX_FILES - currentCount;

  const addFiles = useCallback(
    (incoming: File[]) => {
      setWarning('');
      if (remaining <= 0) {
        setWarning(`최대 ${MAX_FILES}개까지만 추가할 수 있습니다.`);
        return;
      }
      const accepted = incoming.slice(0, remaining);
      if (accepted.length < incoming.length) {
        setWarning(
          `${incoming.length}개 중 ${accepted.length}개만 추가되었습니다. (최대 ${MAX_FILES}개)`,
        );
      }
      onFilesAdded(accepted);
    },
    [remaining, onFilesAdded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      addFiles(Array.from(e.dataTransfer.files));
    },
    [disabled, addFiles],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files || []));
      if (inputRef.current) inputRef.current.value = '';
    },
    [addFiles],
  );

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        <p className="text-4xl mb-3 text-gray-300">&#8682;</p>
        <p className="text-gray-600 font-medium">
          {label} 파일을 드래그하거나 클릭하세요
        </p>
        <p className="text-gray-400 text-sm mt-1">
          최대 {MAX_FILES}개 ({remaining}개 추가 가능)
        </p>
      </div>
      {warning && (
        <p className="mt-2 text-sm text-amber-600">{warning}</p>
      )}
    </div>
  );
}
