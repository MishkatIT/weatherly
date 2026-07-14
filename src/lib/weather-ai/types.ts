export interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  description: string;
  icon: string;
  uv_index?: number;
  precipitation?: number;
}

export interface DailyForecast {
  date: string;
  day_of_week: string;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
  precipitation: number;
}

export interface WeatherResponse {
  current: CurrentWeather;
  daily: DailyForecast[];
  ai_summary?: string;
  is_fallback?: boolean;
  location?: {
    city?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
}

export interface HourlyForecast {
  time: string;
  temp: number;
  description: string;
  icon: string;
  precipitation: number;
}

export interface HourlyResponse {
  hourly: HourlyForecast[];
}

export interface TreeAnalysisResult {
  tree_count: number;
  density_per_acre?: number;
  health_breakdown: {
    healthy: number;
    stressed: number;
    dead_or_diseased: number;
  };
  annotated_image_url: string; // Base64 or overlay URL returned by API
  observations: string[];
  recommendations: string[];
}

export interface TreesQuotaResponse {
  remaining_uploads: number;
  limit_uploads: number;
  reset_time: string;
}

export interface UsageResponse {
  requests_count: number;
  requests_limit: number;
  ai_requests_count: number;
  ai_requests_limit: number;
  billing_period_end: string;
}
