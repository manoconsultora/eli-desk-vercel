import type * as React from "react";

import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Single look for the dashboard list tables (solicitudes, consorcios and its drawer).
// Tables compose these pieces without passing classes, so the design stays in one place.

export type Tone = "green" | "red" | "amber" | "blue" | "violet" | "neutral";

export const TONE_CLASSES: Record<Tone, string> = {
  green: "bg-green-500/10 text-green-700 dark:text-green-400",
  red: "bg-red-500/10 text-red-700 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  neutral: "bg-muted text-muted-foreground",
};

const AVATAR_TONES: Tone[] = ["blue", "violet", "green", "amber"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function ListSearch(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative w-full md:max-w-120 md:flex-1">
      <Search className="-translate-y-1/2 absolute top-1/2 left-4 size-4 text-muted-foreground" />
      <Input className="h-11 rounded-lg pl-11" {...props} />
    </div>
  );
}

export function FilterSelect({ label, ...props }: React.ComponentProps<"select"> & { label: string }) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        className="h-11 appearance-none rounded-lg border bg-background pr-10 pl-4 font-medium text-sm shadow-xs"
        {...props}
      />
      <ChevronDown className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3.5 size-4" />
    </div>
  );
}

export function ListCount({ count, singular, plural }: { count: number; singular: string; plural: string }) {
  return (
    <span className="font-medium text-muted-foreground text-xs md:ml-auto">
      {count} {count === 1 ? singular : plural}
    </span>
  );
}

export function ListEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

export function ListTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table>{children}</Table>
    </div>
  );
}

// desktopOnly hides secondary columns on mobile; the head and its cells must agree.
export function ListHead({ children, desktopOnly }: { children: React.ReactNode; desktopOnly?: boolean }) {
  return <TableHead className={cn("h-11 px-4", desktopOnly && "hidden md:table-cell")}>{children}</TableHead>;
}

// muted: secondary text. wrap: long text (descriptions, lists) that may break lines.
export function ListCell({
  children,
  muted,
  wrap,
  desktopOnly,
}: {
  children: React.ReactNode;
  muted?: boolean;
  wrap?: boolean;
  desktopOnly?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "px-4 py-3",
        wrap && "whitespace-normal",
        muted && "text-muted-foreground text-sm",
        desktopOnly && "hidden md:table-cell",
      )}
    >
      {children}
    </TableCell>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 font-medium text-sm",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ListActionButton(props: Omit<React.ComponentProps<typeof Button>, "variant" | "className">) {
  return (
    <Button
      variant="outline"
      className={cn("h-11 rounded-lg text-sm", props.size === "icon" ? "w-11" : "px-4")}
      {...props}
    />
  );
}

// index keeps the color stable per row position in the full list.
export function Initials({ name, index, large }: { name: string; index: number; large?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        large ? "size-20 rounded-xl text-2xl" : "size-11 rounded-lg text-sm",
        TONE_CLASSES[AVATAR_TONES[index % AVATAR_TONES.length]],
      )}
    >
      {initials(name)}
    </span>
  );
}

export function InitialsAvatar({ name, index }: { name: string; index: number }) {
  return (
    <div className="flex items-center gap-3.5">
      <Initials name={name} index={index} />
      <span className="font-semibold">{name}</span>
    </div>
  );
}
