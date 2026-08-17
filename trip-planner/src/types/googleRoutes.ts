/**
 * @fileoverview Типы для Google Routes API (Compute Route Directions).
 * Используются в DayPlan.tsx для типизации запросов и ответов,
 * так как @types/google.maps не покрывает Routes API New.
 */

/**
 * Тело запроса к Google Routes API.
 * Описывает только те поля, которые используются в приложении.
 */
export interface ComputeRouteRequest {
  origin: RouteLocation;
  destination: RouteLocation;
  travelMode: 'DRIVE' | 'WALK' | 'TRANSIT';
  computeAlternativeRoutes: boolean;
  routingPreference?: 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL' | 'TRAFFIC_UNAWARE';
  'X-Goog-FieldMask': string;
}

interface RouteLocation {
  location: {
    latLng: {
      latitude: number;
      longitude: number;
    };
  };
}

/**
 * Структура ответа Google Routes API.
 */
export interface ComputeRoutesResponse {
  routes: Route[];
}

/**
 * Описывает один маршрут из ответа Routes API.
 */
export interface Route {
  duration: string; // ISO 8601 duration, e.g. "1234s"
  distanceMeters?: number;
  description?: string;
  legs?: RouteLeg[];
}

/**
 * Описывает один "leg" (этап) маршрута.
 */
export interface RouteLeg {
  steps?: RouteStepDetail[];
}

/**
 * Описывает отдельный шаг (step) в рамках leg.
 * Содержит данные о способе передвижения, полилинии и деталях транзита.
 */
export interface RouteStepDetail {
  travelMode?: string; // 'DRIVE' | 'WALK' | 'TRANSIT'
  polyline?: {
    encodedPolyline: string;
  };
  transitDetails?: {
    transitLine?: {
      name?: string;
      shortName?: string;
      color?: string;
      textColor?: string;
      vehicle?: {
        type?: string;
      };
    };
  };
}