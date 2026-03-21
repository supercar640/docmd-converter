'use client';

import { useState, useCallback } from 'react';
import type { ConversionMode, ConvertibleFile } from '@/types';
import { convertDocxToMarkdown } from '@/lib/docxToMarkdown';
import { convertMarkdownToDocx } from '@/lib/markdownToDocx';
import { downloadFiles } from '@/lib/zipDownload';
import {
  replaceExtension,
  isValidDocx,
  isValidMarkdown,
} from '@/lib/fileHelpers';
import ModeToggle from './ModeToggle';
import DropZone from './DropZone';
import FileList from './FileList';

export default function ConverterApp() {
  const [mode, setMode] = useState<ConversionMode>('docx-to-md');
  const [files, setFiles] = useState<ConvertibleFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const handleModeSwitch = useCallback((newMode: ConversionMode) => {
    setFiles([]);
    setMode(newMode);
  }, []);

  const handleFilesAdded = useCallback(
    (newFiles: File[]) => {
      const accepted = newFiles
        .filter((f) =>
          mode === 'docx-to-md' ? isValidDocx(f) : isValidMarkdown(f),
        )
        .map(
          (f): ConvertibleFile => ({
            id: crypto.randomUUID(),
            originalFile: f,
            name: f.name,
            outputName: replaceExtension(
              f.name,
              mode === 'docx-to-md' ? 'md' : 'docx',
            ),
            status: 'pending',
            result: null,
            error: null,
          }),
        );

      setFiles((prev) => [...prev, ...accepted]);
    },
    [mode],
  );

  const convertAll = useCallback(async () => {
    setIsConverting(true);

    const currentFiles = files.filter((f) => f.status === 'pending');

    for (const file of currentFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: 'converting' } : f,
        ),
      );

      try {
        let resultBlob: Blob;

        if (mode === 'docx-to-md') {
          const arrayBuffer = await file.originalFile.arrayBuffer();
          const markdown = await convertDocxToMarkdown(arrayBuffer);
          resultBlob = new Blob([markdown], {
            type: 'text/markdown;charset=utf-8',
          });
        } else {
          const text = await file.originalFile.text();
          resultBlob = await convertMarkdownToDocx(text);
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: 'done', result: resultBlob }
              : f,
          ),
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Conversion failed';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, status: 'error', error: message }
              : f,
          ),
        );
      }
    }

    setIsConverting(false);
  }, [files, mode]);

  const handleDownload = useCallback(() => {
    downloadFiles(files);
  }, [files]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
  }, []);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const totalCount = files.length;
  const convertedCount = files.filter(
    (f) => f.status === 'done' || f.status === 'error',
  ).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">DocMD Converter</h1>
        <p className="mt-2 text-gray-500">
          Word와 Markdown을 배치 변환합니다. 모든 처리는 브라우저에서 이루어집니다.
        </p>
      </div>

      <ModeToggle mode={mode} disabled={isConverting} onChange={handleModeSwitch} />

      <DropZone
        mode={mode}
        currentCount={files.length}
        disabled={isConverting}
        onFilesAdded={handleFilesAdded}
      />

      {totalCount > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={convertAll}
            disabled={pendingCount === 0 || isConverting}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
                       hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            {isConverting ? '변환 중...' : `변환하기 (${pendingCount})`}
          </button>

          {doneCount > 0 && (
            <button
              onClick={handleDownload}
              disabled={isConverting}
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white
                         hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {doneCount === 1 ? '다운로드' : `ZIP 다운로드 (${doneCount}개)`}
            </button>
          )}

          <button
            onClick={clearAll}
            disabled={isConverting}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium
                       text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            전체 삭제
          </button>
        </div>
      )}

      {isConverting && totalCount > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
            <span>변환 진행률</span>
            <span>
              {convertedCount} / {totalCount}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (convertedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      <FileList files={files} onRemove={removeFile} />
    </main>
  );
}
