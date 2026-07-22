/**
 * Data Dashboard — station metadata. The single place to reorder stations or
 * edit copy/paths. The scroll walk runs through STATIONS in array order
 * (clockwise: WEST → NORTH → EAST → SOUTH), then DESCENT, then the interior.
 *
 * Each station is a pair of videos with opposite behaviors (see
 * DashboardScroll.tsx): travel = scroll-scrubbed move, tracks = real-time
 * dwell loop showing observed movement.
 */

export type CompassPoint = "W" | "N" | "E" | "S";

export interface StationDef {
  /** File-name stem, e.g. "01-west" → /videos/01-west-travel.mp4 etc. */
  id: string;
  compass: CompassPoint;
  name: string;
  /** One line describing the area — shown under the station name. */
  caption: string;
  travelSrc: string;
  tracksSrc: string;
  travelPoster: string;
  tracksPoster: string;
}

function station(id: string, compass: CompassPoint, name: string, caption: string): StationDef {
  return {
    id,
    compass,
    name,
    caption,
    travelSrc: `/videos/${id}-travel.mp4`,
    tracksSrc: `/videos/${id}-tracks.mp4`,
    travelPoster: `/images/posters/${id}-travel-poster.jpg`,
    tracksPoster: `/images/posters/${id}-tracks-poster.jpg`,
  };
}

export const STATIONS: StationDef[] = [
  station("01-west", "W", "West", "Greenwich Street flank — facing the memorial plaza."),
  station("02-north", "N", "North", "Fulton Street approach — the commuter corridor from Fulton Center."),
  station("03-east", "E", "East", "Church Street entrance — street doors into the retail balcony."),
  station("04-south", "S", "South", "Liberty Street edge — the quiet side, along Liberty Park."),
];

export const DESCENT = {
  src: "/videos/05-descent.mp4",
  poster: "/images/posters/05-descent-poster.jpg",
};

export const INTERIOR_STILL_SRC = "/images/interior-still.jpg";

/** Flip when the Simulation part ships — the end CTA enables itself. */
export const SIMULATION_ENABLED = false;
