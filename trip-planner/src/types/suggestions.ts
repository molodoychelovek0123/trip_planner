/**
 * @fileoverview Общий тип подсказки (suggestion) для поиска мест.
 * Используется в InlineSearch.tsx и Triplist.tsx для единообразной
 * работы с локальными и API-подсказками.
 */
import type { Place } from '../store';

/**
 * Единая структура подсказки в поиске.
 * Либо локальное место (isLocal=true, place задан),
 * либо результат Google Places API (New) (isLocal=false).
 */
export interface SuggestionItem {
  isLocal: boolean;
  placeId: string;
  description: string;
  place?: Place;
}