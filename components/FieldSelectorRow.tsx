import React from 'react';
import { SelectedField, IdField, Language } from '../types.ts';
import { TrashIcon } from './Icons.tsx';

interface FieldSelectorRowProps {
  id: number;
  selectedField: SelectedField;
  fieldOptions: readonly IdField[];
  languageOptions: readonly { value: Language; label: string }[];
  onUpdate: (id: number, updatedField: Partial<SelectedField>) => void;
  onRemove: (id: number) => void;
  canRemove: boolean;
}

export const FieldSelectorRow: React.FC<FieldSelectorRowProps> = React.memo(({
  id,
  selectedField,
  fieldOptions,
  languageOptions,
  onUpdate,
  onRemove,
  canRemove
}) => {
  const currentFieldOption = selectedField.field ? [selectedField.field] : [];
  const combinedFieldOptions = [...currentFieldOption, ...fieldOptions];

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg" dir="ltr">
      <select
        value={selectedField.field}
        onChange={(e) => onUpdate(id, { field: e.target.value as IdField })}
        className="block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-200"
      >
        <option value="" disabled>Select a field...</option>
        {combinedFieldOptions.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <select
        value={selectedField.language}
        onChange={(e) => onUpdate(id, { language: e.target.value as Language })}
        className="block w-48 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-gray-200"
      >
        {languageOptions.map(lang => (
          <option key={lang.value} value={lang.value}>{lang.label}</option>
        ))}
      </select>
      {canRemove && (
        <button
          onClick={() => onRemove(id)}
          className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          aria-label="Remove field"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
});