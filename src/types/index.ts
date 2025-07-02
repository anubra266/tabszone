export interface Tab {
  title: string;
  favicon: string;
  url: string;
  tabId?: number; // For active tabs, so we can focus them directly
}

export interface TabGroup {
  id: number;
  name: string;
  tabCount: number;
  createdAt: string;
  tabs: Tab[];
  thumbnail?: string; // Base64 screenshot data
  isSaved?: boolean; // Whether this is a saved group or live window
  windowId?: number; // For live windows
}

// Import/Export interfaces
export interface ImportTab {
  title?: string;
  url?: string;
  favicon?: string;
}

export interface ImportGroup {
  name?: string;
  createdAt?: string;
  thumbnail?: string;
  tabs?: ImportTab[];
}

export interface ImportData {
  version?: string;
  timestamp?: string;
  groups?: ImportGroup[];
}
