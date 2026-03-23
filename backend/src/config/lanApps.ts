export type LanApp = {
  id: string;
  name: string;
  description?: string;
  internalUrl: string;
};

export const lanApps: LanApp[] = [
  {
    id: "home-assistant",
    name: "Home Assistant",
    description: "Home automation and dashboards",
    internalUrl: "https://homeassistant.alrusco.com",
  },
  {
    id: "plant-monitor",
    name: "Plant monitor",
    description: "Plant health monitoring",
    internalUrl: "https://plantmonitor.alrusco.com",
  },
  {
    id: "sonarr",
    name: "Sonarr",
    description: "Series management",
    internalUrl: "https://sonarr.alrusco.com",
  },
  {
    id: "radarr",
    name: "Radarr",
    description: "Movie management",
    internalUrl: "https://radarr.alrusco.com",
  },
  {
    id: "qbittorrent",
    name: "qBittorrent",
    description: "Torrent client",
    internalUrl: "https://qbittorrent.alrusco.com",
  },
  {
    id: "deluge",
    name: "Deluge",
    description: "Alternate torrent client",
    internalUrl: "https://deluge.alrusco.com",
  },
];

