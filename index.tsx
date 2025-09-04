import React, { useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

// --- GLOBALS & DECLARES ---

// This is a global type from the sheetjs script in index.html
declare var XLSX: any;
// In a browser environment like GitHub pages, process is not defined.
// We declare it to satisfy TypeScript and handle its absence gracefully.
declare var process: { env: { API_KEY: string } };

// --- CONSTANTS (from constants.ts) ---

const ID_CARD_FIELDS = [
  'ID Number',
  'Name',
  'Expiry Date',
  'Sponsor Name',
  'Sponsor ID',
  'Country',
] as const;

const LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Arabic', label: 'Arabic (عربي)' },
] as const;

const MAX_FILES = 100;

// --- TYPES (from types.ts) ---

type Language = (typeof LANGUAGES)[number]['value'];
type IdField = (typeof ID_CARD_FIELDS)[number];

interface SelectedField {
  id: number;
  field: IdField | '';
  language: Language;
}

type ExtractedData = {
  [key in IdField]?: string;
};

// --- UTILS (from utils/dateUtils.ts) ---

/**
 * Parses a date string (expects YYYY-MM-DD) and checks its expiry status.
 * @param dateStr The date string to parse.
 * @returns An object indicating if the date is expired, expiring soon (within 30 days), and the number of days past expiry.
 */
function parseAndCheckExpiry(dateStr: string): { isExpired: boolean; isExpiringSoon: boolean; daysAfterExpiry: number } {
  const expiryDate = new Date(dateStr);
  if (isNaN(expiryDate.getTime())) {
    return { isExpired: false, isExpiringSoon: false, daysAfterExpiry: 0 };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  const timeDiff = expiryDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  if (daysDiff < 0) {
    return { isExpired: true, isExpiringSoon: false, daysAfterExpiry: Math.abs(daysDiff) };
  }
  if (daysDiff >= 0 && daysDiff <= 30) {
    return { isExpired: false, isExpiringSoon: true, daysAfterExpiry: 0 };
  }
  return { isExpired: false, isExpiringSoon: false, daysAfterExpiry: 0 };
}


// --- ICONS (from components/Icons.tsx) ---

const UploadIcon = () => (
    <svg className="w-12 h-12" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4h12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 28V16m-8 8h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const DownloadIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
    </svg>
);
const PlusIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
    </svg>
);
const TrashIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
    </svg>
);
const LoaderIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
const AlertTriangleIcon = () => (
    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
    </svg>
);
const RefreshIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 11A8.1 8.1 0 004.5 9.5M4 5v4h4m-4 4a8.1 8.1 0 0015.5 1.5M20 19v-4h-4"></path>
    </svg>
);
const XIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
    </svg>
);
const KeyIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.623 5.873l-5.437 5.437a2 2 0 01-2.828-2.828l5.437-5.437A6 6 0 0117 9z"></path></svg>
);


// --- GEMINI SERVICE (from services/geminiService.ts) ---

async function extractIdData(
  apiKey: string,
  base64Image: string,
  mimeType: string,
  fieldsToExtract: SelectedField[]
): Promise<ExtractedData> {
  if (!apiKey) {
    throw new Error('Gemini API Key is required.');
  }
  const ai = new GoogleGenAI({ apiKey });

  const model = 'gemini-2.5-flash';
  const imagePart = { inlineData: { mimeType, data: base64Image } };
  
  const schemaProperties: { [key: string]: { type: Type, description: string } } = {};
  let fieldDescriptions = '';
  
  fieldsToExtract.forEach(item => {
    if (item.field) {
      const schemaKey = item.field.replace(/\s+/g, '_');
      let description = `The ${item.field} extracted from the ID card in ${item.language}.`;
      if (item.field === 'Expiry Date') {
        description = `The Expiry Date extracted from the card, formatted as YYYY-MM-DD.`;
      }
      schemaProperties[schemaKey] = { type: Type.STRING, description };
      fieldDescriptions += `- **${item.field}**: in **${item.language}**\n`;
    }
  });

  const responseSchema = { type: Type.OBJECT, properties: schemaProperties };
  const systemInstruction = `You are an expert multilingual ID card data extraction agent...`; // Instruction omitted for brevity
  const prompt = `Please analyze the provided ID card image...`; // Prompt omitted for brevity

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [imagePart, { text: prompt }] },
    config: { systemInstruction, responseMimeType: 'application/json', responseSchema },
  });
  
  const jsonText = response.text.trim().replace(/^```json\s*|```$/g, '');
  try {
    const parsedJson = JSON.parse(jsonText);
    const finalData: ExtractedData = {};
    for (const key in parsedJson) {
      finalData[key.replace(/_/g, ' ') as IdField] = parsedJson[key];
    }
    return finalData;
  } catch (error) {
    console.error("Failed to parse Gemini response:", jsonText);
    throw new Error("Could not parse the data from the ID card. The response was not valid JSON.");
  }
}

// --- COMPONENTS (from components/*.tsx) ---

// FileUpload.tsx
interface FileUploadProps { onFileChange: (files: FileList | null) => void; fileCount: number; }
const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, fileCount }) => {
  const [isDragging, setIsDragging] = useState(false);
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if (fileCount < MAX_FILES) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (fileCount < MAX_FILES && e.dataTransfer.files?.length) { onFileChange(e.dataTransfer.files); } }, [onFileChange, fileCount]);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) { onFileChange(e.target.files); } e.target.value = ''; };
  const isDisabled = fileCount >= MAX_FILES;
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">1. Upload ID Card(s)</h2>
      <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`relative group border-2 border-dashed rounded-xl p-6 text-center transition-colors duration-300 ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} ${!isDisabled && 'hover:border-blue-400'} ${isDisabled && 'opacity-60 cursor-not-allowed'}`}>
        <input type="file" id="file-upload" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileSelect} accept="image/png, image/jpeg, image/webp" multiple disabled={isDisabled} />
        <div className="flex flex-col items-center justify-center space-y-3 text-gray-500 dark:text-gray-400">
          <UploadIcon />
          <p className="font-semibold">{isDisabled ? 'Maximum file limit reached' : <><span className="text-blue-500">Click to upload</span> or drag and drop</>}</p>
          <p className="text-sm">PNG, JPG or WEBP (up to {MAX_FILES} files)</p>
        </div>
      </div>
    </div>
  );
};

// FieldSelectorRow.tsx
interface FieldSelectorRowProps { id: number; selectedField: SelectedField; fieldOptions: readonly IdField[]; languageOptions: readonly { value: Language; label: string }[]; onUpdate: (id: number, updatedField: Partial<SelectedField>) => void; onRemove: (id: number) => void; canRemove: boolean; }
const FieldSelectorRow: React.FC<FieldSelectorRowProps> = React.memo(({ id, selectedField, fieldOptions, languageOptions, onUpdate, onRemove, canRemove }) => {
  const combinedFieldOptions = [...(selectedField.field ? [selectedField.field] : []), ...fieldOptions];
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg" dir="ltr">
      <select value={selectedField.field} onChange={(e) => onUpdate(id, { field: e.target.value as IdField })} className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-200">
        <option value="" disabled>Select a field...</option>
        {combinedFieldOptions.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      <select value={selectedField.language} onChange={(e) => onUpdate(id, { language: e.target.value as Language })} className="block w-48 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-200">
        {languageOptions.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
      </select>
      {canRemove && <button onClick={() => onRemove(id)} className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors" aria-label="Remove field"><TrashIcon /></button>}
    </div>
  );
});

// ResultsTable.tsx
interface ProcessedRow { 'SL NO': number; [key: string]: string | number | boolean | undefined; isExpired?: boolean; isExpiringSoon?: boolean; }
interface ResultsTableProps { headers: IdField[]; data: ProcessedRow[]; }
const ResultsTable: React.FC<ResultsTableProps> = ({ headers, data }) => {
  const displayHeaders = ['SL NO', ...headers];
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
            <tr>{displayHeaders.map(header => <th key={header} scope="col" className="px-4 py-3 whitespace-nowrap">{header}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                {displayHeaders.map(header => {
                  const isExpiryColumn = header === 'Expiry Date';
                  const textColorClass = isExpiryColumn && row.isExpired ? 'text-red-500 font-semibold' : isExpiryColumn && row.isExpiringSoon ? 'text-yellow-500 font-semibold' : 'dark:text-white';
                  return <td key={header} className={`px-4 py-3 whitespace-nowrap ${textColorClass}`}>{String(row[header] ?? '')}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// --- MAIN APP COMPONENT (from App.tsx) ---

interface ImageFileData { file: File; base64: string; previewUrl: string; }

function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [imageFilesData, setImageFilesData] = useState<ImageFileData[]>([]);
  const [selectedFields, setSelectedFields] = useState<SelectedField[]>([{ id: Date.now(), field: '', language: 'English' }]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedData[] | null>(null);

  const processedResults = useMemo(() => {
    if (!extractedData) return null;
    return extractedData.map((row, index) => {
      const expiryDateStr = row['Expiry Date'];
      const expiryInfo = expiryDateStr ? parseAndCheckExpiry(expiryDateStr) : { isExpired: false, isExpiringSoon: false, daysAfterExpiry: 0 };
      return { ...row, 'SL NO': index + 1, ...expiryInfo };
    });
  }, [extractedData]);

  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, MAX_FILES - imageFilesData.length);
    if (imageFilesData.length + newFiles.length > MAX_FILES) setError(`You can only upload a maximum of ${MAX_FILES} files.`);
    setError(''); setExtractedData(null);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageFilesData(prev => [...prev, { file, base64: base64String, previewUrl: URL.createObjectURL(file) }]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  const handleRemoveImage = useCallback((indexToRemove: number) => {
    setImageFilesData(prev => {
        URL.revokeObjectURL(prev[indexToRemove].previewUrl);
        return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  const currentlySelectedFields = useMemo(() => new Set(selectedFields.map(f => f.field).filter(Boolean)), [selectedFields]);
  const availableFields = useMemo(() => ID_CARD_FIELDS.filter(field => !currentlySelectedFields.has(field)), [currentlySelectedFields]);
  const handleAddField = useCallback(() => { if (selectedFields.length < ID_CARD_FIELDS.length) setSelectedFields(prev => [...prev, { id: Date.now(), field: '', language: 'English' }]); }, [selectedFields.length]);
  const handleRemoveField = useCallback((id: number) => setSelectedFields(prev => prev.filter(field => field.id !== id)), []);
  const handleFieldUpdate = useCallback((id: number, updatedField: Partial<SelectedField>) => setSelectedFields(prev => prev.map(field => (field.id === id ? { ...field, ...updatedField } : field))), []);

  const handleSubmit = async () => {
    const validFields = selectedFields.filter(f => f.field);
    if (!apiKey) { setError('Please enter your Gemini API Key to proceed.'); return; }
    if (imageFilesData.length === 0) { setError('Please upload at least one ID card image.'); return; }
    if (validFields.length === 0) { setError('Please select at least one field to extract.'); return; }
    setError(''); setExtractedData(null); setIsLoading(true); setProgress('Starting extraction...');
    const results: ExtractedData[] = [];
    try {
      for (let i = 0; i < imageFilesData.length; i++) {
        setProgress(`Processing image ${i + 1} of ${imageFilesData.length}...`);
        results.push(await extractIdData(apiKey, imageFilesData[i].base64, imageFilesData[i].file.type, validFields));
      }
      setExtractedData(results);
    } catch (e: any) { setError(`An error occurred: ${e.message || 'Please try again.'}`); } 
    finally { setIsLoading(false); setProgress(''); }
  };

  const handleDownload = () => {
    if (!processedResults) return;
    const orderedHeaders = selectedFields.map(f => f.field).filter((f): f is IdField => !!f);
    const headers = ['SL NO', ...orderedHeaders, 'Days After Expiry'];
    const data = processedResults.map(row => {
        const newRow: (string | number)[] = [row['SL NO']];
        orderedHeaders.forEach(header => newRow.push(row[header] || ''));
        newRow.push(row.daysAfterExpiry);
        return newRow;
    });
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracted Data');
    XLSX.writeFile(workbook, 'id_card_data.xlsx');
  };
  
  const handleRefresh = () => {
    imageFilesData.forEach(data => URL.revokeObjectURL(data.previewUrl));
    setImageFilesData([]);
    setSelectedFields([{ id: Date.now(), field: '', language: 'English' }]);
    setIsLoading(false); setProgress(''); setError(''); setExtractedData(null);
    setApiKey('');
  };
  
  const isSubmitDisabled = isLoading || imageFilesData.length === 0 || selectedFields.every(f => !f.field) || !apiKey;
  const orderedHeadersForTable = useMemo(() => selectedFields.map(f => f.field).filter((f): f is IdField => !!f), [selectedFields]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 font-sans">
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-8">
        <header className="flex justify-between items-start text-center">
          <div className="w-10"></div>
          <div className="flex-grow">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">ID Card Data Extractor</h1>
            <p className="text-md text-gray-500 dark:text-gray-400 mt-2">Upload IDs, select fields, and export to Excel.</p>
          </div>
          <button onClick={handleRefresh} className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" aria-label="Refresh page"><RefreshIcon /></button>
        </header>

        <FileUpload onFileChange={handleFileChange} fileCount={imageFilesData.length} />
        
        {imageFilesData.length > 0 && (
            <div className="space-y-2">
                 <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Uploaded Files ({imageFilesData.length}/{MAX_FILES})</h3>
                 <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-60 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                     {imageFilesData.map((imageData, index) => (
                         <div key={imageData.file.name + index} className="relative group aspect-w-1 aspect-h-1 rounded-lg overflow-hidden">
                             <img src={imageData.previewUrl} alt={`preview ${index}`} className="w-full h-full object-cover"/>
                             <button onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 hover:bg-red-700" aria-label="Remove image"><XIcon /></button>
                         </div>
                     ))}
                 </div>
            </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">2. Select Data to Extract</h2>
          <div className="space-y-3">{selectedFields.map(field => <FieldSelectorRow key={field.id} id={field.id} selectedField={field} fieldOptions={availableFields} languageOptions={LANGUAGES} onUpdate={handleFieldUpdate} onRemove={handleRemoveField} canRemove={selectedFields.length > 1} />)}</div>
          <button onClick={handleAddField} disabled={selectedFields.length >= ID_CARD_FIELDS.length} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-gray-700 rounded-lg hover:bg-blue-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><PlusIcon /> Add Another Field</button>
        </div>

        <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">3. Provide Key</h2>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyIcon />
                </div>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Key here"
                    className="block w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-200"
                    aria-label="Gemini API Key"
                />
            </div>
        </div>

        <div>
            <button onClick={handleSubmit} disabled={isSubmitDisabled} className="w-full flex items-center justify-center gap-3 px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-105">
                {isLoading ? <><LoaderIcon /> {progress || 'Processing...'}</> : `Extract Data from ${imageFilesData.length} Image(s)`}
            </button>
        </div>

        {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md flex items-center gap-3" role="alert">
              <AlertTriangleIcon />
              <div><p className="font-bold">Error</p><p>{error}</p></div>
            </div>
        )}
        
        {processedResults && (
            <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-800 dark:text-green-200 p-4 rounded-md space-y-4">
              <div className="flex items-center gap-3"><p className="font-bold text-lg">Extraction Complete!</p></div>
              <p>Successfully extracted data from {processedResults.length} ID card(s). Review the results below.</p>
              <ResultsTable headers={orderedHeadersForTable} data={processedResults} />
              <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-6 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform hover:scale-105"><DownloadIcon /> Download Excel</button>
            </div>
        )}
      </div>
    </div>
  );
}

// --- RENDER APPLICATION ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
