/** Minimal typings for hosted WebGL Earth 2 API (https://www.webglearth.com/v2/api.js) */
export type WebGLEarthMap = {
  setView: (center: [number, number], zoom: number) => void
  remove?: () => void
}

export type WebGLEarthTileLayer = {
  addTo: (map: WebGLEarthMap) => WebGLEarthTileLayer
}

export type WebGLEarthGlobal = {
  map: (elementId: string) => WebGLEarthMap
  tileLayer: (url: string, options?: Record<string, unknown>) => WebGLEarthTileLayer
}

declare global {
  interface Window {
    WE?: WebGLEarthGlobal
  }
}

export {}
