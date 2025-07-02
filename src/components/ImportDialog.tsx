import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importJsonText: string;
  onImportJsonTextChange: (text: string) => void;
  onImport: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onOpenChange,
  importJsonText,
  onImportJsonTextChange,
  onImport,
}) => {
  const handleCancel = () => {
    onOpenChange(false);
    onImportJsonTextChange("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onChange={(e) => onImportJsonTextChange(e.target.value)}
            placeholder="Paste JSON content here..."
            className="w-full h-32 p-3 border rounded-md resize-none font-mono text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={onImport}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
