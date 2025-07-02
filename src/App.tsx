import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useState, useEffect } from "react";

interface Tab {
  title: string;
  favicon: string;
  url: string;
  tabId?: number; // For active tabs, so we can focus them directly
}

interface TabGroup {
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
interface ImportTab {
  title?: string;
  url?: string;
  favicon?: string;
}

interface ImportGroup {
  name?: string;
  createdAt?: string;
  thumbnail?: string;
  tabs?: ImportTab[];
}

interface ImportData {
  version?: string;
  timestamp?: string;
  groups?: ImportGroup[];
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Save,
  FolderOpen,
  Trash2,
  Search,
  MoreVertical,
  ExternalLink,
  Clock,
  Globe,
  ChevronDown,
  ChevronRight,
  Settings,
  Download,
  Upload,
} from "lucide-react";

export default function App() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [groupToDelete, setGroupToDelete] = useState<TabGroup | null>(null);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [allGroups, setAllGroups] = useState<TabGroup[]>([]);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>("");

  // Store original group names for windows created from saved groups
  const [windowGroupNames, setWindowGroupNames] = useState<Map<number, string>>(
    new Map()
  );

  // Thumbnail-related state
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(
    new Map()
  );

  // Load all groups (saved + live windows) on mount
  useEffect(() => {
    const initializeApp = async () => {
      const cache = await loadThumbnailCache();
      await loadAllGroups(cache);
    };
    initializeApp();
  }, []);

  // Screenshot caching functions

  // Chrome extension functions
  const loadAllGroups = async (cache?: Map<string, string>) => {
    try {
      // Use provided cache or fallback to current state
      const currentCache = cache || thumbnailCache;

      // Always load the latest window group names from storage
      const currentWindowGroupNames = await loadWindowGroupNames();

      // Get current window
      const currentWindow = await chrome.windows.getCurrent();
      setCurrentWindowId(currentWindow.id || null);

      // Get all windows and their tabs
      const windows = await chrome.windows.getAll({ populate: true });

      const liveGroups: TabGroup[] = [];

      for (const window of windows) {
        const tabs = window.tabs || [];
        // Filter out chrome:// internal pages
        const filteredTabs = tabs.filter(
          (tab) => tab.url && !tab.url.startsWith("chrome://")
        );

        const windowTabs: Tab[] = filteredTabs.map((tab) => ({
          title: tab.title || "Untitled",
          favicon:
            tab.favIconUrl ||
            `https://picsum.photos/32/32?random=${Math.floor(
              Math.random() * 1000
            )}`,
          url: tab.url || "",
          tabId: tab.id, // Include tab ID for active tabs
        }));

        // Skip windows with no valid tabs
        if (windowTabs.length === 0) {
          continue;
        }

        // Check if we have a stored name for this window (from opened saved group)
        // Otherwise, use the first tab's title for window name
        let windowName = window.id
          ? currentWindowGroupNames.get(window.id)
          : undefined;
        if (!windowName) {
          const firstTabTitle = windowTabs[0]?.title || "Untitled";
          windowName =
            firstTabTitle.length > 30
              ? firstTabTitle.substring(0, 30) + "..."
              : firstTabTitle;
        }

        // Check cache first, then capture if needed
        let thumbnail = undefined;
        if (window.id) {
          const cacheKey = getThumbnailCacheKey(window.id, window.id);
          thumbnail = currentCache.get(cacheKey);

          // Only capture new screenshot if not in cache
          if (!thumbnail) {
            thumbnail = await captureActiveTabScreenshot(window.id);
            if (thumbnail) {
              const newCache = new Map(currentCache);
              newCache.set(cacheKey, thumbnail);
              setThumbnailCache(newCache);
              await saveThumbnailCache(newCache);
            }
          }
        }

        liveGroups.push({
          id: window.id || Date.now(),
          name: windowName,
          tabCount: windowTabs.length,
          createdAt: "Active",
          tabs: windowTabs,
          thumbnail,
          isSaved: false,
          windowId: window.id,
        });
      }

      // Get saved groups
      const result = await chrome.storage.local.get(["tabGroups"]);
      const savedGroups: TabGroup[] = result.tabGroups
        ? result.tabGroups.map((group: TabGroup) => ({
            ...group,
            isSaved: true,
          }))
        : [];

      // Clean up window group names for windows that no longer exist
      const currentWindowIds = new Set(
        windows.map((w) => w.id).filter(Boolean)
      );
      const updatedWindowGroupNames = new Map(currentWindowGroupNames);
      let shouldUpdateNames = false;

      for (const [windowId] of currentWindowGroupNames) {
        if (!currentWindowIds.has(windowId)) {
          updatedWindowGroupNames.delete(windowId);
          shouldUpdateNames = true;
        }
      }

      if (shouldUpdateNames) {
        setWindowGroupNames(updatedWindowGroupNames);
        await saveWindowGroupNames(updatedWindowGroupNames);
      }

      // Combine live windows and saved groups
      setAllGroups([...liveGroups, ...savedGroups]);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  };

  const saveTabGroups = async (groups: TabGroup[]) => {
    try {
      // Only save the saved groups (filter out live windows)
      const savedOnly = groups.filter((group) => group.isSaved);
      await chrome.storage.local.set({ tabGroups: savedOnly });
    } catch (error) {
      console.error("Failed to save tab groups:", error);
    }
  };

  // Filter and organize groups
  const filteredGroups = allGroups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentGroup = filteredGroups.find(
    (group) => group.windowId === currentWindowId && !group.isSaved
  );

  // Sort active groups by window ID (newer windows have higher IDs, indicating more recent activity)
  const activeGroups = filteredGroups
    .filter((group) => group.windowId !== currentWindowId && !group.isSaved)
    .sort((a, b) => (b.windowId || 0) - (a.windowId || 0));

  // Sort saved groups by creation time (most recently saved first)
  const savedGroups = filteredGroups
    .filter((group) => group.isSaved)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Most recent first
    });

  const handleSaveGroup = async (group: TabGroup) => {
    try {
      // Capture thumbnail before saving if it's an active group
      let thumbnail = group.thumbnail;
      if (!thumbnail && group.windowId) {
        thumbnail = await captureActiveTabScreenshot(group.windowId);
      }

      const newSavedGroup: TabGroup = {
        ...group,
        id: Date.now(),
        createdAt: new Date().toLocaleString(),
        thumbnail,
        isSaved: true,
        windowId: undefined, // Remove windowId for saved groups
        // Remove tabId from tabs since they're no longer live
        tabs: group.tabs.map((tab) => ({
          title: tab.title,
          favicon: tab.favicon,
          url: tab.url,
        })),
      };

      const updatedGroups = [...allGroups, newSavedGroup];
      setAllGroups(updatedGroups);
      await saveTabGroups(updatedGroups);

      // Close the window after saving
      if (group.windowId) {
        try {
          await chrome.windows.remove(group.windowId);

          // Refresh groups to update the UI
          setTimeout(async () => {
            await loadAllGroups();
          }, 200);
        } catch (error) {
          console.warn(`Failed to close window ${group.windowId}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to save group:", error);
    }
  };

  const handleOpenGroup = async (group: TabGroup) => {
    try {
      const window = await chrome.windows.create({});
      if (!window) {
        throw new Error("Failed to create window");
      }

      for (const tab of group.tabs) {
        await chrome.tabs.create({
          windowId: window.id,
          url: tab.url,
        });
      }
      // Close the default empty tab
      const tabs = await chrome.tabs.query({ windowId: window.id });
      if (tabs.length > group.tabs.length) {
        const tabId = tabs[0].id;
        if (tabId) chrome.tabs.remove(tabId);
      }

      // Preserve the thumbnail in cache when converting saved group to active
      if (group.isSaved && group.thumbnail && window.id) {
        const cacheKey = getThumbnailCacheKey(window.id, window.id);
        const newCache = new Map(thumbnailCache);
        newCache.set(cacheKey, group.thumbnail);
        setThumbnailCache(newCache);
        await saveThumbnailCache(newCache);
      }

      // Store the group name for this window so it retains its name when converted to active
      if (group.isSaved && window.id) {
        const newWindowGroupNames = new Map(windowGroupNames);
        newWindowGroupNames.set(window.id, group.name);
        setWindowGroupNames(newWindowGroupNames);
        await saveWindowGroupNames(newWindowGroupNames);
      }

      // Remove the group from saved groups since it's now active
      if (group.isSaved) {
        const updatedGroups = allGroups.filter((g) => g.id !== group.id);
        setAllGroups(updatedGroups);
        await saveTabGroups(updatedGroups);
      }

      // Small delay to ensure window is fully created, then refresh groups
      setTimeout(async () => {
        await loadAllGroups();
      }, 500);
    } catch (error) {
      console.error("Failed to open tab group:", error);
    }
  };

  const handleDeleteGroup = (group: TabGroup) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;

    const updatedGroups = allGroups.filter((g) => g.id !== groupToDelete.id);
    setAllGroups(updatedGroups);
    await saveTabGroups(updatedGroups);
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const saveRename = async () => {
    if (editingGroup === null) return;

    // Find the original group to check if name actually changed
    const originalGroup = allGroups.find((g) => g.id === editingGroup);
    if (originalGroup && originalGroup.name !== newGroupName.trim()) {
      const updatedGroups = allGroups.map((g) =>
        g.id === editingGroup ? { ...g, name: newGroupName.trim() } : g
      );
      setAllGroups(updatedGroups);
      await saveTabGroups(updatedGroups);
    }

    setEditingGroup(null);
    setNewGroupName("");
  };

  const toggleGroupExpansion = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleOpenSingleTab = async (tab: Tab, group: TabGroup) => {
    try {
      // If it's an active tab (has tabId and windowId), focus the existing tab
      if (tab.tabId && group.windowId && !group.isSaved) {
        // Focus the window first
        await chrome.windows.update(group.windowId, { focused: true });
        // Then activate the specific tab
        await chrome.tabs.update(tab.tabId, { active: true });
      } else {
        // For saved groups, create a new tab
        await chrome.tabs.create({ url: tab.url });
      }
    } catch (error) {
      console.error("Failed to open tab:", error);
    }
  };

  // Import/Export functions
  const handleExportGroups = () => {
    const savedOnly = allGroups.filter((group) => group.isSaved);
    const exportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      groups: savedOnly.map((group) => ({
        name: group.name,
        createdAt: group.createdAt,
        thumbnail: group.thumbnail,
        tabs: group.tabs.map((tab) => ({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon,
        })),
      })),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tabszone-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFromText = async () => {
    try {
      if (!importJsonText.trim()) {
        return;
      }

      const importData: ImportData = JSON.parse(importJsonText);

      if (!importData.groups || !Array.isArray(importData.groups)) {
        throw new Error("Invalid file format");
      }

      const importedGroups: TabGroup[] = importData.groups.map(
        (group: ImportGroup, index: number) => ({
          id: Date.now() + index,
          name: group.name || "Imported Group",
          tabCount: group.tabs?.length || 0,
          createdAt: group.createdAt || new Date().toLocaleString(),
          thumbnail: group.thumbnail,
          tabs:
            group.tabs?.map((tab: ImportTab) => ({
              title: tab.title || "Untitled",
              url: tab.url || "",
              favicon:
                tab.favicon ||
                `https://picsum.photos/32/32?random=${Math.floor(
                  Math.random() * 1000
                )}`,
            })) || [],
          isSaved: true,
        })
      );

      const updatedGroups = [...allGroups, ...importedGroups];
      setAllGroups(updatedGroups);
      await saveTabGroups(updatedGroups);

      // Close dialog and reset
      setImportDialogOpen(false);
      setImportJsonText("");
    } catch (error) {
      // Import failed, keep dialog open for user to retry
      console.error("Failed to import groups:", error);
    }
  };

  const renderGroupCard = (group: TabGroup) => (
    <Card
      key={group.id}
      className="hover:bg-accent/50 transition-colors py-0 rounded-md"
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Top Row: Thumbnail and Title/Info */}
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              {getThumbnailForGroup(group) ? (
                <img
                  src={getThumbnailForGroup(group)}
                  alt={`${group.name} thumbnail`}
                  className="w-20 h-15 object-cover rounded border"
                />
              ) : (
                <div className="w-20 h-15">
                  <svg
                    width="80"
                    height="60"
                    viewBox="0 0 80 60"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="rounded border bg-muted"
                  >
                    <rect width="80" height="60" fill="hsl(var(--muted))" />
                    <g opacity="0.4">
                      <rect
                        x="20"
                        y="15"
                        width="40"
                        height="3"
                        rx="1.5"
                        fill="hsl(var(--muted-foreground))"
                      />
                      <rect
                        x="15"
                        y="22"
                        width="50"
                        height="2"
                        rx="1"
                        fill="hsl(var(--muted-foreground))"
                      />
                      <rect
                        x="25"
                        y="28"
                        width="30"
                        height="2"
                        rx="1"
                        fill="hsl(var(--muted-foreground))"
                      />
                      <rect
                        x="20"
                        y="38"
                        width="40"
                        height="8"
                        rx="4"
                        fill="hsl(var(--muted-foreground))"
                      />
                    </g>
                  </svg>
                </div>
              )}
            </div>

            {/* Title and Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-2">
                  {/* Title Line */}
                  <div className="flex items-center gap-2 mb-1">
                    {editingGroup === group.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => toggleGroupExpansion(group.id)}
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </Button>
                        <Input
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="h-6 text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setEditingGroup(null);
                          }}
                          onBlur={saveRename}
                          autoFocus
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 flex-shrink-0"
                          onClick={() => toggleGroupExpansion(group.id)}
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </Button>
                        <h3
                          className="font-medium text-sm truncate cursor-text hover:text-primary flex-1"
                          onClick={() => {
                            setEditingGroup(group.id);
                            setNewGroupName(group.name);
                          }}
                          title="Click to edit name"
                        >
                          {group.name}
                        </h3>
                      </>
                    )}
                  </div>

                  {/* Info Line */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {group.tabCount} tabs
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {group.createdAt === "Active"
                        ? "Active"
                        : new Date(group.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* More Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 flex-shrink-0"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {group.isSaved ? (
                      <>
                        <DropdownMenuItem
                          onClick={() => handleOpenGroup(group)}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open All
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteGroup(group)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={() => handleSaveGroup(group)}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Group
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Bottom Row: Tab Preview */}
          {!expandedGroups.has(group.id) && (
            <div className="flex flex-wrap gap-1">
              {group.tabs.slice(0, 4).map((tab, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs"
                >
                  <img
                    src={tab.favicon}
                    alt=""
                    className="w-3 h-3 rounded-sm object-cover flex-shrink-0"
                  />
                  <span className="truncate max-w-24">
                    {tab.title.split(" - ")[0]}
                  </span>
                </div>
              ))}
              {group.tabs.length > 4 && (
                <div className="bg-muted rounded px-2 py-1 text-xs">
                  +{group.tabs.length - 4} more
                </div>
              )}
            </div>
          )}

          {/* Action Button Row */}
          <div className="flex justify-end">
            {group.isSaved ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenGroup(group)}
                className="h-7 text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open All
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSaveGroup(group)}
                className="h-7 text-xs"
              >
                <Save className="w-3 h-3 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Tab List - Full Width */}
        {expandedGroups.has(group.id) && (
          <div className="mt-3 pt-3 border-t space-y-1 max-h-32 overflow-y-auto">
            {group.tabs.map((tab, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer group transition-colors"
                onClick={() => handleOpenSingleTab(tab, group)}
              >
                <img
                  src={tab.favicon}
                  alt=""
                  className="w-4 h-4 rounded-sm object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate group-hover:text-primary">
                    {tab.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {tab.url}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Thumbnail management functions
  const getThumbnailCacheKey = (groupId: number, windowId?: number) => {
    return `thumbnail_${windowId || groupId}`;
  };

  const loadThumbnailCache = async (): Promise<Map<string, string>> => {
    try {
      const result = await chrome.storage.local.get(["thumbnailCache"]);
      const cache = result.thumbnailCache
        ? new Map(Object.entries(result.thumbnailCache))
        : new Map();
      setThumbnailCache(cache);
      return cache;
    } catch (error) {
      console.error("Failed to load thumbnail cache:", error);
      return new Map();
    }
  };

  const saveThumbnailCache = async (cache: Map<string, string>) => {
    try {
      const cacheObj = Object.fromEntries(cache);
      await chrome.storage.local.set({ thumbnailCache: cacheObj });
    } catch (error) {
      console.error("Failed to save thumbnail cache:", error);
    }
  };

  const captureActiveTabScreenshot = async (
    windowId: number
  ): Promise<string | undefined> => {
    try {
      // Get the active tab in the specified window
      const tabs = await chrome.tabs.query({ windowId, active: true });
      if (!tabs[0]) return undefined;

      // Capture screenshot of the active tab
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "jpeg",
        quality: 80,
      });

      return dataUrl;
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
      return undefined;
    }
  };

  const getThumbnailForGroup = (group: TabGroup): string | undefined => {
    const cacheKey = getThumbnailCacheKey(group.id, group.windowId);
    return thumbnailCache.get(cacheKey) || group.thumbnail;
  };

  // Window group names management functions
  const loadWindowGroupNames = async (): Promise<Map<number, string>> => {
    try {
      const result = await chrome.storage.local.get(["windowGroupNames"]);
      const storedNames = result.windowGroupNames || {};
      const namesMap = new Map<number, string>();

      // Convert stored object back to Map
      for (const [windowId, name] of Object.entries(storedNames)) {
        namesMap.set(parseInt(windowId), name as string);
      }

      setWindowGroupNames(namesMap);
      return namesMap;
    } catch (error) {
      console.error("Failed to load window group names:", error);
      return new Map();
    }
  };

  const saveWindowGroupNames = async (namesMap: Map<number, string>) => {
    try {
      // Convert Map to plain object for storage
      const namesObject: Record<string, string> = {};
      for (const [windowId, name] of namesMap) {
        namesObject[windowId.toString()] = name;
      }

      await chrome.storage.local.set({ windowGroupNames: namesObject });
    } catch (error) {
      console.error("Failed to save window group names:", error);
    }
  };

  return (
    <div className="w-80 h-[500px] bg-background border shadow-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">TabsZone</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {allGroups.length} groups
            </Badge>
            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportGroups}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Groups
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Groups
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Groups List */}
      <ScrollArea className="flex-1 h-96">
        <div className="p-2">
          {/* Current Group */}
          {currentGroup && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                Current Group
              </h2>
              <div className="space-y-2">{renderGroupCard(currentGroup)}</div>
            </div>
          )}

          {/* Active Groups */}
          {activeGroups.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                Active Groups
              </h2>
              <div className="space-y-2">
                {activeGroups.map((group) => renderGroupCard(group))}
              </div>
            </div>
          )}

          {/* Saved Groups */}
          {savedGroups.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                Saved Groups
              </h2>
              <div className="space-y-2">
                {savedGroups.map((group) => renderGroupCard(group))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!currentGroup &&
            activeGroups.length === 0 &&
            savedGroups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No groups found</p>
              </div>
            )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tab Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{groupToDelete?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Groups Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Groups</DialogTitle>
            <DialogDescription>
              Paste your TabsZone JSON export below to import saved groups.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON content here..."
              className="w-full h-32 p-3 border rounded-md resize-none font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportJsonText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImportFromText}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
