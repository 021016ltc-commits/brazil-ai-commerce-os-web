"use client";

import { RefreshCcw } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/Button";

export function QuickActions() {
  const { dictionary } = useLanguage();

  return (
    <Button type="button" variant="secondary" className="h-9" onClick={() => window.location.reload()}>
      <RefreshCcw className="h-4 w-4" aria-hidden="true" />
      {dictionary.common.refresh}
    </Button>
  );
}
