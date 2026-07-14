export const cacheKeys = {
  weatherGeo: (ip: string) => `weather:geo:${ip}`,

  reverseGeocode: (lat: number, lon: number) => {
    const roundedLat = lat.toFixed(3);
    const roundedLon = lon.toFixed(3);
    return `geocode:reverse:${roundedLat}:${roundedLon}`;
  },

  weather: ({
    lat,
    lon,
    units,
    days,
    ai,
  }: {
    lat: number;
    lon: number;
    units: string;
    days: number;
    ai: boolean;
  }) => {
    // Round lat/lon to 2 decimal places to increase cache hits for search proximity
    const roundedLat = lat.toFixed(2);
    const roundedLon = lon.toFixed(2);
    return `weather:current:${roundedLat}:${roundedLon}:${units}:${days}:${ai}`;
  },

  hourly: (lat: number, lon: number, units: string) => {
    const roundedLat = lat.toFixed(2);
    const roundedLon = lon.toFixed(2);
    return `weather:hourly:${roundedLat}:${roundedLon}:${units}`;
  },

  geocode: (query: string) => {
    const normalized = query.trim().toLowerCase();
    return `geocode:${normalized}`;
  },

  usage: () => "usage:global",
};
