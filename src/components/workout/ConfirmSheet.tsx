import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { FONT, W } from "./WorkoutBits";

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
  extra,
  cancelOutlined = false,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  extra?: { label: string; onClick: () => void; danger?: boolean };
  cancelOutlined?: boolean;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onCancel()} shouldScaleBackground={false}>
      <DrawerContent className="rounded-t-[24px] border-0 bg-white p-0 pb-[max(env(safe-area-inset-bottom),16px)]" style={{ fontFamily: FONT, color: W.ink }}>
        <div className="flex flex-col gap-2 px-4 pt-4">
          <DrawerTitle className="text-[20px] font-extrabold leading-tight">{title}</DrawerTitle>
          <DrawerDescription className="text-[15px]" style={{ color: W.stone }}>
            {body}
          </DrawerDescription>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="h-[52px] rounded-[26px] text-[16px] font-bold text-white"
              style={{ background: danger ? "#DC2626" : W.purple }}
            >
              {confirmLabel}
            </button>
            {extra && (
              <button
                type="button"
                onClick={extra.onClick}
                className="h-[52px] rounded-[26px] text-[16px] font-bold"
                style={{ border: `1.5px solid ${W.line}`, color: extra.danger ? "#DC2626" : W.ink }}
              >
                {extra.label}
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="h-[52px] rounded-[26px] text-[16px] font-bold"
              style={cancelOutlined ? { color: W.ink, border: `1.5px solid ${W.line}`, background: "#FFFFFF" } : { color: W.ink }}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
