/**
 * Декларация глобального `window.google` для доступа к Google Maps API.
 * Глобальное пространство имён `google` предоставляется `@types/google.maps`,
 * а здесь мы добавляем его на объект `window`.
 */
interface Window {
  google: typeof google;
}