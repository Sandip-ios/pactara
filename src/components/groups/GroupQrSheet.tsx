import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

const PURPLE = "#7C3AED";

/**
 * CashApp-style scannable invite code for a group. The QR simply encodes the
 * existing /join/<groupId> invite link, so scanning it with any phone camera
 * drops the person into the normal invite flow.
 */
export function GroupQrSheet({
  open,
  onOpenChange,
  groupName,
  emoji,
  inviteLink,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupName: string;
  emoji: string;
  inviteLink: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(inviteLink, {
          width: 720,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#1C1917", light: "#FFFFFF" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, inviteLink]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const share = async () => {
    const text = "Accept your invite to my Pactara group!";
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: text, text, url: inviteLink });
        return;
      }
    } catch {
      // user dismissed or unsupported
    }
    copy();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-sheet pt-2 border-0" style={{ background: PURPLE }}>
        <DrawerTitle className="sr-only">Scan to join {groupName}</DrawerTitle>

        <div className="flex flex-col items-center pt-4">
          <div className="text-[15px] font-bold text-white/90 flex items-center gap-1.5">
            <span>{emoji}</span>
            <span className="truncate max-w-[220px]">{groupName}</span>
          </div>

          <div className="mt-5 rounded-[28px] bg-white p-5 shadow-xl">
            <div className="h-[220px] w-[220px] flex items-center justify-center">
              {dataUrl ? (
                <img src={dataUrl} alt={`QR code to join ${groupName}`} className="h-full w-full" />
              ) : (
                <div className="h-full w-full rounded-2xl bg-neutral-100 animate-pulse" />
              )}
            </div>
          </div>

          <div className="mt-5 text-[20px] font-black text-white text-center">Scan to join</div>
          <div className="mt-1 text-[13px] text-white/80 text-center max-w-[260px]">
            Point a phone camera at this code to open the invite.
          </div>

          <div className="mt-6 w-full flex gap-3">
            <button
              onClick={copy}
              className="flex-1 rounded-2xl py-4 text-[15px] font-bold flex items-center justify-center gap-2 bg-white/15 text-white"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={share}
              className="flex-1 rounded-2xl py-4 text-[15px] font-bold flex items-center justify-center gap-2 bg-white"
              style={{ color: PURPLE }}
            >
              <Share2 size={18} />
              Share
            </button>
          </div>

          <button
            onClick={() => onOpenChange(false)}
            className="mt-3 w-full rounded-2xl py-3 text-[15px] font-semibold text-white/80"
          >
            Close
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
