import React from 'react';
import { IdField } from '../types.ts';

interface ProcessedRow {
  'SL NO': number;
  [key: string]: string | number | boolean | undefined;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

interface ResultsTableProps {
  headers: IdField[];
  data: ProcessedRow[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ headers, data }) => {
  const displayHeaders = ['SL NO', ...headers];
  
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
            <tr>
              {displayHeaders.map(header => (
                <th key={header} scope="col" className="px-4 py-3 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                {displayHeaders.map(header => {
                  const isExpiryColumn = header === 'Expiry Date';
                  const isExpired = !!row.isExpired;
                  const isExpiringSoon = !!row.isExpiringSoon;
                  const cellContent = row[header] ?? '';
                  
                  let textColorClass = 'dark:text-white';
                  if (isExpiryColumn) {
                    if (isExpired) {
                      textColorClass = 'text-red-500 font-semibold';
                    } else if (isExpiringSoon) {
                      textColorClass = 'text-yellow-500 font-semibold';
                    }
                  }

                  return (
                    <td 
                      key={header} 
                      className={`px-4 py-3 whitespace-nowrap ${textColorClass}`}
                    >
                      {cellContent.toString()}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};