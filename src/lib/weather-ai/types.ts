export interface CurrentWeather {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_deg?: number;
  description: string;
  icon: string;
  pressure?: number;
  visibility?: number;
  clouds?: number;
  dew_point?: number;
  uv_index?: number;
  precipitation?: number;
  sunrise?: number;
  sunset?: number;
  aqi?: number;
}

export interface DailyForecast {
  date: string;
  day_of_week: string;
  temp_min: number;
  temp_max: number;
  temp_day?: number;
  temp_night?: number;
  description: string;
  icon: string;
  precipitation: number;
  pop?: number;
  uv_index?: number;
  sunrise?: number;
  sunset?: number;
  humidity?: number;
  wind_speed?: number;
}

export interface HourlyForecastItem {
  time: string;
  temp: number;
  feels_like?: number;
  description: string;
  icon: string;
  precipitation: number;
  pop?: number;
  wind_speed?: number;
  humidity?: number;
}

export interface WeatherAlert {
  sender_name: string;
  event: string;
  start: number;
  end: number;
  description: string;
}

export interface WeatherResponse {
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly?: HourlyForecastItem[];
  alerts?: WeatherAlert[];
  location?: {
    city?: string;
    country?: string;
    lat?: number;
    lon?: number;
    timezone?: string | number;
  };
}

export interface HourlyResponse {
  hourly: HourlyForecastItem[];
}
