import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Image as ImageIcon, Send } from "lucide-react";
import { getMyGroupStatus } from "@/lib/groups.functions";
import { OnboardingSheet } from "@/components/OnboardingSheet";

const PURPLE = "#7C3AED";
const BG = "#F5F2EE";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { data: status, isLoading } = useQuery({
    queryKey: ["my-group-status"],
    queryFn: () => getMyGroupStatus(),
  });

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const pickImage = () => {
    setComposerOpen(true);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    e.target.value = "";
  };

  useEffect(() => {
    if (composerOpen) composerRef.current?.focus();
  }, [composerOpen]);

  useEffect(() => {
    const dismissed = typeof sessionStorage !== "undefined" && sessionStorage.getItem("invite-dismissed") === "1";
    if (status && !dismissed && (!status.hasGroup || status.memberCount <= 1)) {
      navigate({ to: "/invite", replace: true });
      return;
    }
    if (status && typeof localStorage !== "undefined" && !localStorage.getItem("onboarded")) {
      setShowOnboarding(true);
    }
  }, [status, navigate]);

  const dismissOnboarding = () => {
    if (typeof localStorage !== "undefined") localStorage.setItem("onboarded", "1");
    setShowOnboarding(false);
  };

  const initials = (status?.firstName || "U").slice(0, 1).toUpperCase();
  const firstName = status?.firstName || "there";

  return (
    <div className="min-h-[100dvh] w-full pb-24" style={{ background: BG, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="bg-white px-6 pt-5 pb-4">
        <div className="text-[24px] font-black tracking-tight">
          <span style={{ color: PURPLE }}>P</span><span>actara</span>
        </div>
      </header>

      {!status && <div aria-hidden className="px-6 pt-4 text-[13px] opacity-0">.</div>}

      <div className="px-6 pt-4 flex items-center justify-between text-[13px]">
        <span className="font-semibold">Day 1 of 30</span>
        <span className="text-neutral-400">29d left</span>
      </div>

      {!composerOpen ? (
        <div className="mx-4 mt-3 rounded-2xl bg-white p-3 flex items-center gap-3 shadow-sm">
          <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#22C55E" }}>
            {initials}
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            className="flex-1 text-left rounded-full bg-neutral-100 px-4 py-3 text-[15px] text-neutral-400"
          >
            What's on your mind, {status.firstName}?
          </button>
          <button onClick={pickImage} className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center" aria-label="Add photo">
            <ImageIcon size={20} className="text-green-600" />
          </button>
        </div>
      ) : (
        <div className="mx-4 mt-3 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="flex gap-3 p-4">
            <div className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "#22C55E" }}>
              {initials}
            </div>
            <textarea
              ref={composerRef}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={`What's on your mind, ${status.firstName}?`}
              className="flex-1 resize-none outline-none text-[15px] placeholder:text-neutral-400 min-h-[96px] bg-transparent"
            />
          </div>
          {imagePreview && (
            <div className="px-4 pb-3">
              <div className="relative inline-block">
                <img src={imagePreview} alt="Selected" className="max-h-48 rounded-lg" />
                <button
                  onClick={() => setImagePreview(null)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full h-6 w-6 text-xs"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          <div className="border-t border-neutral-100 px-3 py-2 flex items-center justify-between">
            <button onClick={pickImage} className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center" aria-label="Add photo">
              <ImageIcon size={20} className="text-green-600" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setComposerOpen(false); setComposerText(""); setImagePreview(null); }}
                className="px-4 py-2 rounded-full bg-neutral-100 text-[14px] font-semibold text-neutral-700"
              >
                Cancel
              </button>
              <button
                disabled={!composerText.trim() && !imagePreview}
                className="px-4 py-2 rounded-full text-white text-[14px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: (composerText.trim() || imagePreview) ? PURPLE : "#D4D4D4" }}
              >
                <Send size={16} />
                Post
              </button>
            </div>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <div className="px-6 pt-6">
        <div className="text-[15px] font-bold">Waiting to check in <span className="text-neutral-400 font-normal">1</span></div>
      </div>

      <div className="px-4 mt-3">
        <div className="w-[160px] rounded-2xl bg-white border border-purple-100 p-4 flex flex-col items-center">
          <div className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ background: "#22C55E" }}>
            {initials}
          </div>
          <div className="mt-2 text-[15px] font-semibold">You</div>
          <button className="mt-3 w-full rounded-full py-2 text-white text-[14px] font-semibold" style={{ background: PURPLE }}>
            Check in
          </button>
        </div>
      </div>

      <div className="mx-4 mt-6 rounded-2xl bg-white p-8 flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-full bg-purple-50 flex items-center justify-center mb-3">
          <MessageSquare size={24} style={{ color: PURPLE }} />
        </div>
        <div className="text-[16px] font-bold">Your feed is empty</div>
        <div className="text-[13px] text-neutral-500 mt-1 max-w-[260px]">
          Share what's on your mind or check in to start your streak.
        </div>
      </div>

      <BottomTabs />
      {showOnboarding && <OnboardingSheet firstName={status.firstName || "there"} onClose={dismissOnboarding} />}
    </div>
  );
}

function BottomTabs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-neutral-200 px-2 pt-2 pb-6 grid grid-cols-5 items-end">
      <TabItem icon={<Home size={22} />} label="Home" active />
      <TabItem icon={<Users size={22} />} label="Groups" onClick={() => navigate({ to: "/groups" })} />

      <button onClick={() => navigate({ to: "/check-in" })} className="flex flex-col items-center gap-1 -mt-6">
        <span className="h-14 w-14 rounded-full flex items-center justify-center text-white" style={{ background: PURPLE }}>
          <Zap size={24} />
        </span>
        <span className="text-[11px] font-medium">Check In</span>
      </button>
      <TabItem icon={<MessageCircle size={22} />} label="Chat" />
      <button onClick={handleSignOut} className="flex flex-col items-center gap-1 text-neutral-400">
        <UserIcon size={22} />
        <span className="text-[11px] font-medium">Profile</span>
      </button>
    </nav>
  );
}

function TabItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1" style={{ color: active ? PURPLE : "#A3A3A3" }}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

