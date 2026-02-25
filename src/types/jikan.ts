/**
 * Jikan v4 API (MyAnimeList) response types
 */

export interface JikanSearchResponse {
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
  data: JikanAnime[];
}

export interface JikanAnimeDetailResponse {
  data: JikanAnime;
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  synopsis: string | null;
  genres: JikanGenre[];
  themes: JikanGenre[];
  demographics: JikanGenre[];
  type: string;
  episodes: number | null;
  status: string;
  score: number | null;
  year: number | null;
  aired: {
    from: string | null;
    to: string | null;
  };
  duration: string;
}

export interface JikanGenre {
  mal_id: number;
  name: string;
}
