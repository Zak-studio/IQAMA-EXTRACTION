import React, { useCallback, useState } from 'react';
import { UploadIcon } from './Icons.tsx';
import { MAX_FILES } from '../constants.ts';

interface FileUploadProps {
  onFileChange: (files: FileList | null) => void;
  fileCount: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, fileCount }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileCount >= MAX_FILES) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (fileCount >= MAX_FILES) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileChange(e.dataTransfer.files);
    }
  }, [onFileChange, fileCount]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileChange(e.target.files);
    }
    // Reset input value to allow re-selecting the same file(s) if needed
    e.target.value = '';
  };

  const isDisabled = fileCount >= MAX_FILES;

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">1. Upload ID Card(s)</h2>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative group border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-300 ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} ${!isDisabled && 'hover:border-blue-400'} ${isDisabled && 'opacity-60 cursor-not-allowed'}`}
      >
        <input
          type="file"
          id="file-upload"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileSelect}
          accept="image/png, image/jpeg, image/webp"
          multiple
          disabled={isDisabled}
        />
        <div className="flex flex-col items-center justify-center space-y-3 text-gray-500 dark:text-gray-400">
          <UploadIcon />
          <p className="font-semibold">
            {isDisabled ? 'Maximum file limit reached' : <><span className="text-blue-500">Click to upload</span> or drag and drop</>}
          </p>
          <p className="text-sm">PNG, JPG or WEBP (up to {MAX_FILES} files)</p>
        </div>
      </div>
    </div>
  );
};