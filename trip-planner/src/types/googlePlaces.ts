/**
 * @fileoverview Типы для Google Places API (New) — Autocomplete.
 * Используются в InlineSearch.tsx и Triplist.tsx для типизации ответа
 * автодополнения. @types/google.maps не покрывает Places API New.
 */

/**
 * Обёртка ответа автодополнения Places API (New).
 */
export interface AutocompleteResponse {
  suggestions: PlacePredictionWrapper[];
}

/**
 * Элемент массива suggestions — обёртка над предсказанием места.
 */
export interface PlacePredictionWrapper {
  placePrediction: {
    placeId: string;
    text: {
      text: string;
    };
  };
}