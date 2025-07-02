import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, FolderOpen, Settings, Download, Upload } from "lucide-react";

import type { TabGroup } from "./types";
import { useTabGroups } from "./hooks/useTabGroups";
import { useImportExport } from "./hooks/useImportExport";
import { GroupCard } from "./components/GroupCard";
import { ImportDialog } from "./components/ImportDialog";
import { DeleteDialog } from "./components/DeleteDialog";

export default function App() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [groupToDelete, setGroupToDelete] = useState<TabGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Use custom hooks
  const {
    allGroups,
    currentWindowId,
    thumbnailCache,
    handleSaveGroup,
    handleOpenGroup,
    handleDeleteGroup,
    handleRenameGroup,
    handleOpenSingleTab,
  } = useTabGroups();

  const {
    importDialogOpen,
    setImportDialogOpen,
    importJsonText,
    setImportJsonText,
    handleExportGroups,
    handleImportFromText,
  } = useImportExport();

  // Filter and organize groups
  const filteredGroups = allGroups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentGroup = filteredGroups.find(
    (group) => group.windowId === currentWindowId && !group.isSaved
  );

  // Sort active groups by window ID
  const activeGroups = filteredGroups
    .filter((group) => group.windowId !== currentWindowId && !group.isSaved)
    .sort((a, b) => (b.windowId || 0) - (a.windowId || 0));

  // Sort saved groups by creation time
  const savedGroups = filteredGroups
    .filter((group) => group.isSaved)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

  const toggleGroupExpansion = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleDeleteGroupClick = (group: TabGroup) => {
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;
    await handleDeleteGroup(groupToDelete.id);
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const handleImport = async () => {
    await handleImportFromText(allGroups, () => {
      // Groups will be updated by the hook
    });
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
                <DropdownMenuItem onClick={() => handleExportGroups(allGroups)}>
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
              <div className="space-y-2">
                <GroupCard
                  group={currentGroup}
                  thumbnailCache={thumbnailCache}
                  expandedGroups={expandedGroups}
                  onToggleExpansion={toggleGroupExpansion}
                  onSaveGroup={handleSaveGroup}
                  onOpenGroup={handleOpenGroup}
                  onDeleteGroup={handleDeleteGroupClick}
                  onRenameGroup={handleRenameGroup}
                  onOpenSingleTab={handleOpenSingleTab}
                />
              </div>
            </div>
          )}

          {/* Active Groups */}
          {activeGroups.length > 0 && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                Active Groups
              </h2>
              <div className="space-y-2">
                {activeGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    thumbnailCache={thumbnailCache}
                    expandedGroups={expandedGroups}
                    onToggleExpansion={toggleGroupExpansion}
                    onSaveGroup={handleSaveGroup}
                    onOpenGroup={handleOpenGroup}
                    onDeleteGroup={handleDeleteGroupClick}
                    onRenameGroup={handleRenameGroup}
                    onOpenSingleTab={handleOpenSingleTab}
                  />
                ))}
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
                {savedGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    thumbnailCache={thumbnailCache}
                    expandedGroups={expandedGroups}
                    onToggleExpansion={toggleGroupExpansion}
                    onSaveGroup={handleSaveGroup}
                    onOpenGroup={handleOpenGroup}
                    onDeleteGroup={handleDeleteGroupClick}
                    onRenameGroup={handleRenameGroup}
                    onOpenSingleTab={handleOpenSingleTab}
                  />
                ))}
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
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        groupToDelete={groupToDelete}
        onConfirmDelete={confirmDelete}
      />

      {/* Import Groups Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importJsonText={importJsonText}
        onImportJsonTextChange={setImportJsonText}
        onImport={handleImport}
      />
    </div>
  );
}
