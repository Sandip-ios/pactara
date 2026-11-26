import type { ComponentProps, ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Check, ChevronRight } from "lucide-react";
import { Drawer, DrawerPortal, DrawerOverlay, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CrewAvatarOverlap, type RedesignCrewAvatarMember } from "./CrewAvatars";

/** All redesign sheets share this surface; classic DrawerContent stays untouched. */
export function NewSheet({ open, onOpenChange, title, subtitle, description, hideTitle = false, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; hideTitle?: boolean;
  subtitle?: string; description?: string; children: ReactNode;
}) {
  return <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerPortal>
      <DrawerOverlay className="new-sheet bg-[var(--new-sheet-overlay)]" />
      <DrawerPrimitive.Content className="new-sheet fixed inset-x-0 bottom-0 z-[70] flex max-h-[calc(100dvh-60px)] flex-col overflow-y-auto rounded-t-[24px] border-0 bg-[var(--new-white)] px-5 pt-[10px] pb-[calc(40px+env(safe-area-inset-bottom))] text-[var(--new-ink)] outline-none">
        <div className="mx-auto mb-[14px] h-[5px] w-9 shrink-0 rounded-[3px] bg-[var(--new-handle)]" aria-hidden />
        <DrawerTitle className={hideTitle ? "sr-only" : "m-0 text-[20px] font-extrabold text-[var(--new-ink)] tracking-normal"}>{title}</DrawerTitle>
        <DrawerDescription className={subtitle ? "mt-1 text-[14px] text-[var(--new-muted)]" : "sr-only"}>{subtitle ?? description ?? title}</DrawerDescription>
        <div className={hideTitle ? undefined : "mt-[10px]"}>{children}</div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  </Drawer>;
}

type SheetButtonProps = ComponentProps<typeof Button>;
export function NewSheetRow({ title, subtitle, leading, trailing, simple = false, destructive = false, className, ...props }: Omit<SheetButtonProps, "title"> & {
  title: ReactNode; subtitle?: ReactNode; leading?: ReactNode; trailing?: ReactNode; simple?: boolean; destructive?: boolean;
}) {
  return <Button variant="ghost" {...props} className={cn("h-auto w-full justify-start gap-3 whitespace-normal rounded-none border-b border-[var(--new-divider)] px-0 py-3 text-left last:border-b-0 disabled:opacity-50", simple && "h-[52px]", className)}>
    {leading && <span className="flex shrink-0 items-center [&>svg]:!size-[22px]">{leading}</span>}
    <span className="min-w-0 flex-1">
      <span className={cn("block text-[16px] text-[var(--new-ink)]", simple ? "font-semibold" : "font-bold", destructive && "text-[var(--new-destructive)]")}>{title}</span>
      {subtitle && <span className="mt-0.5 block text-[13px] font-normal text-[var(--new-muted)]">{subtitle}</span>}
    </span>
    {trailing}
  </Button>;
}

export function NewSheetIcon({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "primary" | "meal" }) {
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] [&>svg]:!size-5", tone === "primary" ? "bg-[var(--new-purple)] text-[var(--new-white)]" : tone === "meal" ? "bg-[var(--new-orange-soft)] text-[var(--new-orange-icon)]" : "bg-[var(--new-soft)] text-[var(--new-purple)]")}>{children}</span>;
}

/** Avatar rows use the stack's own width; NewSheetRow supplies the 12px text gap. */
export function NewSheetAvatars({ members }: { members: RedesignCrewAvatarMember[] }) {
  return <CrewAvatarOverlap members={members} size={30} limit={4} />;
}

export function NewSheetChevron() { return <ChevronRight size={20} className="!size-5 shrink-0 text-[var(--new-chevron)]" />; }
export function NewSheetCheckbox({ checked }: { checked: boolean }) {
  return <span aria-hidden className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border", checked ? "border-[var(--new-purple)] bg-[var(--new-purple)] text-[var(--new-white)]" : "border-[var(--new-muted)]")}>
    {checked && <Check size={18} className="!size-[18px]" />}
  </span>;
}
export function NewSheetButton({ secondary = false, className, ...props }: SheetButtonProps & { secondary?: boolean }) {
  return <Button variant="ghost" {...props} className={cn("h-[52px] w-full rounded-[26px] text-[17px] font-bold disabled:opacity-60", secondary ? "mt-[10px] bg-[var(--new-soft)] text-[var(--new-purple-text)] hover:bg-[var(--new-soft)] hover:text-[var(--new-purple-text)]" : "mt-4 bg-[var(--new-purple)] text-[var(--new-white)] hover:bg-[var(--new-purple)] hover:text-[var(--new-white)]", className)} />;
}
export function NewSheetChip({ selected, className, ...props }: SheetButtonProps & { selected: boolean }) {
  return <Button variant="ghost" aria-pressed={selected} {...props} className={cn("h-9 rounded-full border px-3 text-[14px] font-semibold", selected ? "border-[var(--new-purple)] bg-[var(--new-soft)] text-[var(--new-purple-text)] hover:bg-[var(--new-soft)] hover:text-[var(--new-purple-text)]" : "border-[var(--new-handle)] bg-[var(--new-white)] text-[var(--new-ink)] hover:bg-[var(--new-white)] hover:text-[var(--new-ink)]", className)} />;
}