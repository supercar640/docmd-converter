export type ConversionMode = 'docx-to-md' | 'md-to-docx';

export type FileStatus = 'pending' | 'converting' | 'done' | 'error';

export interface ConvertibleFile {
  id: string;
  originalFile: File;
  name: string;
  outputName: string;
  status: FileStatus;
  result: Blob | null;
  error: string | null;
}

export const MAX_FILES = 50;
