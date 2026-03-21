'use client';

import type { ConversionMode } from '@/types';

interface ModeToggleProps {
  mode: ConversionMode;
  disabled: boolean;
  onChange: (mode: ConversionMode) => void;
}

export default function ModeToggle({ mode, disabled, onChange }: ModeToggleProps) {
  return (
    <div className="flex justify-center mb-8">
      <div className="inline-flex rounded-lg bg-gray-200 p-1">
        <button
          onClick={() => onChange('docx-to-md')}
          disabled={disabled}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors
            ${mode === 'docx-to-md'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          DOCX → Markdown
        </button>
        <button
          onClick={() => onChange('md-to-docx')}
          disabled={disabled}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors
            ${mode === 'md-to-docx'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Markdown → DOCX
        </button>
      </div>
    </div>
  );
}
