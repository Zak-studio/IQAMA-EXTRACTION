import { ID_CARD_FIELDS, LANGUAGES } from './constants.ts';

export type Language = (typeof LANGUAGES)[number]['value'];
export type IdField = (typeof ID_CARD_FIELDS)[number];

export interface SelectedField {
  id: number;
  field: IdField | '';
  language: Language;
}

export type ExtractedData = {
  [key in IdField]?: string;
};