import { wgs84ToGcj02, outOfChina } from '../utils/coords';

export function MapDeepLinks({ 
  originLat, originLng, originName, 
  destLat, destLng, destName 
}: { 
  originLat?: number, originLng?: number, originName?: string, 
  destLat?: number, destLng?: number, destName?: string 
}) {
  if (!originLat || !originLng || !destLat || !destLng) return null;

  const isChina = !outOfChina(originLng, originLat) || !outOfChina(destLng, destLat);
  const googleMapsUri = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=transit`;

  if (!isChina) {
    return (
      <div className="inline-block ml-auto mt-2 w-full text-right">
        <a href={googleMapsUri} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded inline-flex items-center gap-1 transition-colors shadow-sm">
          Открыть в Google Maps
        </a>
      </div>
    );
  }

  const [gcjSlng, gcjSlat] = wgs84ToGcj02(originLng, originLat);
  const [gcjDlng, gcjDlat] = wgs84ToGcj02(destLng, destLat);
  const aMapUri = `https://uri.amap.com/navigation?from=${gcjSlng},${gcjSlat},${encodeURIComponent(originName || '')}&to=${gcjDlng},${gcjDlat},${encodeURIComponent(destName || '')}&mode=bus&callnative=1`;

  return (
    <div className="relative group inline-block ml-auto mt-2 w-full text-right">
      <button className="text-[11px] font-medium text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded inline-flex items-center gap-1 transition-colors shadow-sm">
        Открыть в
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div className="absolute right-0 bottom-full mb-1 hidden group-hover:flex flex-col bg-white border border-slate-200 shadow-lg rounded-md overflow-hidden z-20 min-w-[140px]">
        <a href={googleMapsUri} target="_blank" rel="noreferrer" className="text-[11px] px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors text-left border-b border-slate-100 flex items-center justify-between">
          <span>Google Maps</span>
        </a>
        <a href={aMapUri} target="_blank" rel="noreferrer" className="text-[11px] px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left flex items-center justify-between">
          <span>AMap (高德)</span>
        </a>
      </div>
    </div>
  );
}
