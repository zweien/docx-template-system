"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { VersionHistoryDialog } from "@/components/templates/version-history-dialog";

export function VersionHistoryDialogWrapper({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <History className="h-4 w-4" />
        版本历史
      </Button>
      <VersionHistoryDialog
        templateId={templateId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
