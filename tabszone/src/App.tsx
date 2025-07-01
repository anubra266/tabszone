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
  DropdownMenuTrigger,
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

  // Load all groups (saved + live windows) on mount
  useEffect(() => {
    loadAllGroups();
  }, []);

  // Screenshot caching functions

  // Chrome extension functions
  const loadAllGroups = async () => {
    try {
      // Get current window
      const currentWindow = await chrome.windows.getCurrent();
      setCurrentWindowId(currentWindow.id || null);

      // Get all windows and their tabs
      const windows = await chrome.windows.getAll({ populate: true });

      const liveGroups: TabGroup[] = windows.map((window) => {
        const tabs = window.tabs || [];
        const windowTabs: Tab[] = tabs.map((tab) => ({
          title: tab.title || "Untitled",
          favicon:
            tab.favIconUrl ||
            `https://picsum.photos/32/32?random=${Math.floor(
              Math.random() * 1000
            )}`,
          url: tab.url || "",
          tabId: tab.id, // Include tab ID for active tabs
        }));

        // Get the first tab's title for window name
        const firstTabTitle = windowTabs[0]?.title || "Untitled";
        const windowName =
          firstTabTitle.length > 30
            ? firstTabTitle.substring(0, 30) + "..."
            : firstTabTitle;

        return {
          id: window.id || Date.now(),
          name: windowName,
          tabCount: windowTabs.length,
          createdAt: "Active",
          tabs: windowTabs,
          isSaved: false,
          windowId: window.id,
        };
      });

      // Get saved groups
      const result = await chrome.storage.local.get(["tabGroups"]);
      const savedGroups: TabGroup[] = result.tabGroups
        ? result.tabGroups.map((group: TabGroup) => ({
            ...group,
            isSaved: true,
          }))
        : [];

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
  const activeGroups = filteredGroups.filter(
    (group) => group.windowId !== currentWindowId && !group.isSaved
  );
  const savedGroups = filteredGroups.filter((group) => group.isSaved);

  const handleSaveGroup = async (group: TabGroup) => {
    try {
      const newSavedGroup: TabGroup = {
        ...group,
        id: Date.now(),
        createdAt: new Date().toLocaleString(),
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

      console.log(
        `Saved group: ${newSavedGroup.name} with ${newSavedGroup.tabs.length} tabs`
      );

      // Close the window after saving
      if (group.windowId) {
        try {
          await chrome.windows.remove(group.windowId);
          console.log(`Closed window ${group.windowId} after saving`);

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

      // Remove the group from saved groups since it's now active
      if (group.isSaved) {
        const updatedGroups = allGroups.filter((g) => g.id !== group.id);
        setAllGroups(updatedGroups);
        await saveTabGroups(updatedGroups);
        console.log(`Removed saved group "${group.name}" as it's now active`);
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
      console.log("Importing from textarea, length:", importJsonText.length);

      if (!importJsonText.trim()) {
        alert("Please paste JSON content first.");
        return;
      }

      const importData: ImportData = JSON.parse(importJsonText);
      console.log("Parsed import data:", importData);

      if (!importData.groups || !Array.isArray(importData.groups)) {
        throw new Error("Invalid file format");
      }

      const importedGroups: TabGroup[] = importData.groups.map(
        (group: ImportGroup, index: number) => ({
          id: Date.now() + index,
          name: group.name || "Imported Group",
          tabCount: group.tabs?.length || 0,
          createdAt: group.createdAt || new Date().toLocaleString(),
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

      console.log(`Imported ${importedGroups.length} groups successfully`);
      console.log("Imported groups:", importedGroups);

      // Close dialog and reset
      setImportDialogOpen(false);
      setImportJsonText("");

      // Show user feedback
      alert(`Successfully imported ${importedGroups.length} groups!`);
    } catch (error) {
      console.error("Failed to import groups:", error);
      alert("Failed to import groups. Please check the JSON format.");
    }
  };

  const renderGroupCard = (group: TabGroup) => (
    <Card
      key={group.id}
      className="hover:bg-accent/50 transition-colors py-0 rounded-md"
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  {editingGroup === group.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
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
                        className="h-7 text-sm flex-1"
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
                        className="h-6 w-6 p-0 flex-shrink-0"
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

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {group.tabCount} tabs
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {group.createdAt}
                  </span>
                </div>

                {/* Collapsed Preview */}
                {!expandedGroups.has(group.id) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {group.tabs.slice(0, 2).map((tab, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 text-xs max-w-20"
                      >
                        <img
                          src={tab.favicon}
                          alt=""
                          className="w-3 h-3 rounded-sm object-cover flex-shrink-0"
                        />
                        <span className="truncate">
                          {tab.title.split(" - ")[0]}
                        </span>
                      </div>
                    ))}
                    {group.tabs.length > 2 && (
                      <div className="bg-muted rounded px-1.5 py-0.5 text-xs">
                        +{group.tabs.length - 2}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  {group.isSaved ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenGroup(group)}
                      className="h-7 text-xs flex-1"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open All
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleSaveGroup(group)}
                      className="h-7 text-xs flex-1"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                  )}
                </div>
              </div>

              {/* More Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {group.isSaved ? (
                    <DropdownMenuItem onClick={() => handleOpenGroup(group)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open All
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleSaveGroup(group)}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Group
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDeleteGroup(group)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
      <AlertDialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Groups</AlertDialogTitle>
            <AlertDialogDescription>
              Paste your TabsZone JSON export below to import saved groups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste JSON content here..."
              className="w-full h-32 p-3 border rounded-md resize-none font-mono text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setImportJsonText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleImportFromText}>
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
