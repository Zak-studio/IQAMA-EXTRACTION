import React, { useState, useCallback, useMemo } from 'react';
import { SelectedField, IdField, ExtractedData } from './types.ts';
import { ID_CARD_FIELDS, LANGUAGES, MAX_FILES } from './constants.ts';
import { extractIdData } from './services/geminiService.ts';
import { parseAndCheckExpiry } from './utils/dateUtils.ts';
import { FileUpload } from './components/FileUpload.tsx';
import { FieldSelectorRow } from './components/FieldSelectorRow.tsx';
import { ResultsTable } from './components/ResultsTable.tsx';
import { DownloadIcon, PlusIcon, LoaderIcon, AlertTriangleIcon, RefreshIcon, XIcon } from './components/Icons.tsx';

// This is a global type from the sheetjs script in index.html
declare var XLSX: any;

interface ImageFileData {
  file: File;
  base64: string;
  previewUrl: string;
}

export default function App() {
  const [imageFilesData, setImageFilesData] = useState<ImageFileData[]>([]);
  const [selectedFields, setSelectedFields] = useState<SelectedField[]>([
    { id: Date.now(), field: '', language: 'English' },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedData[] | null>(null);

  const processedResults = useMemo(() => {
    if (!extractedData) return null;

    return extractedData.map((row, index) => {
      const expiryDateStr = row['Expiry Date'];
      const expiryInfo = expiryDateStr ? parseAndCheckExpiry(expiryDateStr) : { isExpired: false, isExpiringSoon: false, daysAfterExpiry: 0 };

      return {
        ...row,
        'SL NO': index + 1,
        isExpired: expiryInfo.isExpired,
        isExpiringSoon: expiryInfo.isExpiringSoon,
        daysAfterExpiry: expiryInfo.daysAfterExpiry,
      };
    });
  }, [extractedData]);

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);

    if (imageFilesData.length + newFiles.length > MAX_FILES) {
      setError(`You can only upload a maximum of ${MAX_FILES} files.`);
      return;
    }

    const validFiles = newFiles.filter(file => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError(`File "${file.name}" has an invalid type. Only JPG, PNG, or WEBP are allowed.`);
            return false;
        }
        return true;
    });

    if(validFiles.length < newFiles.length) {
        // Error for invalid files is already set. Stop processing this batch.
        return;
    }
    
    setError('');
    setExtractedData(null);

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        const previewUrl = URL.createObjectURL(file);
        setImageFilesData(prev => [...prev, { file, base64: base64String, previewUrl }]);
      };
      reader.onerror = () => {
        setError(prev => (prev ? prev + `\nFailed to read file: ${file.name}.` : `Failed to read file: ${file.name}.`));
      };
    });
  };
  
  const handleRemoveImage = useCallback((indexToRemove: number) => {
    setImageFilesData(prev => {
        const newFiles = prev.filter((_, index) => index !== indexToRemove);
        // Revoke the object URL to prevent memory leaks
        URL.revokeObjectURL(prev[indexToRemove].previewUrl);
        return newFiles;
    });
  }, []);

  const currentlySelectedFields = useMemo(() => 
    new Set(selectedFields.map(f => f.field).filter(Boolean)),
    [selectedFields]
  );
  
  const availableFields = useMemo(() => 
    ID_CARD_FIELDS.filter(field => !currentlySelectedFields.has(field)),
    [currentlySelectedFields]
  );

  const handleAddField = useCallback(() => {
    if (selectedFields.length < ID_CARD_FIELDS.length) {
      setSelectedFields(prev => [
        ...prev,
        { id: Date.now(), field: '', language: 'English' },
      ]);
    }
  }, [selectedFields.length]);

  const handleRemoveField = useCallback((id: number) => {
    setSelectedFields(prev => prev.filter(field => field.id !== id));
  }, []);

  const handleFieldUpdate = useCallback((id: number, updatedField: Partial<SelectedField>) => {
    setSelectedFields(prev =>
      prev.map(field => (field.id === id ? { ...field, ...updatedField } : field))
    );
  }, []);

  const handleSubmit = async () => {
    const validFields = selectedFields.filter(f => f.field);
    if (imageFilesData.length === 0) {
      setError('Please upload at least one ID card image.');
      return;
    }
    if (validFields.length === 0) {
      setError('Please select at least one field to extract.');
      return;
    }
    
    setError('');
    setExtractedData(null);
    setIsLoading(true);
    setProgress('Starting extraction...');

    const results: ExtractedData[] = [];
    try {
      for (let i = 0; i < imageFilesData.length; i++) {
        const imageData = imageFilesData[i];
        setProgress(`Processing image ${i + 1} of ${imageFilesData.length}...`);
        const result = await extractIdData(imageData.base64, imageData.file.type, validFields);
        results.push(result);
      }
      setExtractedData(results);
    } catch (e: any) {
      console.error(e);
      setError(`An error occurred during extraction: ${e.message || 'Please try again.'}`);
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  };

  const handleDownload = () => {
    if (!processedResults) return;

    const orderedHeaders = selectedFields
      .map(f => f.field)
      .filter((f): f is IdField => !!f);
      
    // Create header row with serial number and days after expiry
    const headers = ['SL NO', ...orderedHeaders, 'Days After Expiry'];
    
    // Create data rows respecting the selected order
    const data = processedResults.map(row => {
        const newRow: (string | number)[] = [row['SL NO']]; // SL NO
        for (const header of orderedHeaders) {
            newRow.push(row[header] || ''); // Ensure value exists, default to empty string
        }
        newRow.push(row.daysAfterExpiry); // Days After Expiry
        return newRow;
    });

    const worksheetData = [headers, ...data];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracted Data');
    XLSX.writeFile(workbook, 'id_card_data.xlsx');
  };
  
  const handleRefresh = () => {
    // Revoke any existing object URLs to prevent memory leaks
    imageFilesData.forEach(data => URL.revokeObjectURL(data.previewUrl));

    // Reset all state to initial values
    setImageFilesData([]);
    setSelectedFields([{ id: Date.now(), field: '', language: 'English' }]);
    setIsLoading(false);
    setProgress('');
    setError('');
    setExtractedData(null);
  };
  
  const isSubmitDisabled = isLoading || imageFilesData.length === 0 || selectedFields.every(f => !f.field);

  const orderedHeadersForTable = useMemo(() => selectedFields
      .map(f => f.field)
      .filter((f): f is IdField => !!f), [selectedFields]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 font-sans">
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-8 transform transition-all">
        <header className="flex justify-between items-start text-center">
          <div className="w-10"></div> {/* Spacer */}
          <div className="flex-grow">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">ID Card Data Extractor</h1>
            <p className="text-md text-gray-500 dark:text-gray-400 mt-2">Upload up to 100 IDs, select fields, and export to Excel.</p>
          </div>
          <button onClick={handleRefresh} className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" aria-label="Refresh page">
            <RefreshIcon />
          </button>
        </header>

        <FileUpload onFileChange={handleFileChange} fileCount={imageFilesData.length} />
        
        {imageFilesData.length > 0 && (
            <div className="space-y-2">
                 <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Uploaded Files ({imageFilesData.length}/{MAX_FILES})</h3>
                 <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-60 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                     {imageFilesData.map((imageData, index) => (
                         <div key={imageData.file.name + index} className="relative group aspect-w-1 aspect-h-1 rounded-lg overflow-hidden">
                             <img src={imageData.previewUrl} alt={`preview ${index}`} className="w-full h-full object-cover"/>
                             <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center">
                                <button onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 hover:bg-red-700" aria-label="Remove image">
                                    <XIcon />
                                </button>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">2. Select Data to Extract</h2>
          <div className="space-y-3">
            {selectedFields.map((field) => (
              <FieldSelectorRow
                key={field.id}
                id={field.id}
                selectedField={field}
                fieldOptions={availableFields}
                languageOptions={LANGUAGES}
                onUpdate={handleFieldUpdate}
                onRemove={handleRemoveField}
                canRemove={selectedFields.length > 1}
              />
            ))}
          </div>
          <button
            onClick={handleAddField}
            disabled={selectedFields.length >= ID_CARD_FIELDS.length}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-gray-700 rounded-lg hover:bg-blue-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PlusIcon />
            Add Another Field
          </button>
        </div>

        <div>
            <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
                {isLoading ? <><LoaderIcon /> {progress || 'Processing...'}</> : `Extract Data from ${imageFilesData.length} Image(s)`}
            </button>
        </div>

        {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-center gap-3" role="alert">
              <AlertTriangleIcon />
              <div>
                <p className="font-bold">Error</p>
                <p>{error}</p>
              </div>
            </div>
        )}
        
        {processedResults && (
            <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-800 dark:text-green-200 p-4 rounded-md space-y-4">
              <div className="flex items-center gap-3">
                <p className="font-bold text-lg">Extraction Complete!</p>
              </div>
              <p>Successfully extracted data from {processedResults.length} ID card(s). Review the results below and download the Excel file.</p>
              
              <ResultsTable headers={orderedHeadersForTable} data={processedResults} />

              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform hover:scale-105"
              >
                <DownloadIcon />
                Download Excel
              </button>
            </div>
        )}
      </div>
    </div>
  );
}