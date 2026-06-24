/**
 * Response shapes for the Database timeline view (GET /api/sessions?include=timeline).
 * Mirrors the payload assembled in src/lib/sessions/timeline-query.ts.
 */

import type { MediaType } from "@/lib/db/types";

export interface TimelineAttendee {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface TimelineRating {
  average: number;
  count: number;
}

export interface TimelineTake {
  text: string;
  by: string | null;
}

export interface TimelineEntry {
  sessionId: string;
  mediaId: string;
  title: string;
  type: MediaType;
  posterUrl: string | null;
  dateWatched: string | null;
  week: number | null;
  pickerName: string | null;
  rating: TimelineRating | null;
  attendees: TimelineAttendee[];
  attendeeCount: number;
  take: TimelineTake | null;
}

export interface TimelinePayload {
  items: TimelineEntry[];
  page: number;
  limit: number;
  groupSize: number;
  hasMore: boolean;
}
