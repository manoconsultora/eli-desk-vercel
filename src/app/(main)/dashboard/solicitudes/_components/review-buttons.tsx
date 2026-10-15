import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TONES = {
  approve: "border-green-500/30 bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-400",
  reject: "border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400",
};

export function ReviewButton({
  kind,
  children,
  disabled,
  onClick,
  className,
}: {
  kind: keyof typeof TONES;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const Icon = kind === "approve" ? Check : X;
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={cn("shadow-none", TONES[kind], className)}
    >
      <Icon className="size-4" />
      {children}
    </Button>
  );
}
