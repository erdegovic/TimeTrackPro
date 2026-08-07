import { useState } from "react";
import { ChevronLeft, ChevronRight, Music, FileText, Lightbulb, Target, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import CreativityPanelPlayer from "./SpotifyStylePlayer";
import NotesSection from "./NotesSection";
import InspirationSection from "./InspirationSection";
import WeeklyGoals from "./WeeklyGoals";
import WellnessSection from "./WellnessSection";

interface CreativitySidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  /** Controls the sheet presentation used below the docked breakpoint. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const sections = [
  { id: "music", label: "Music", icon: Music },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "inspiration", label: "Inspire", icon: Lightbulb },
  { id: "goals", label: "Goals", icon: Target },
  { id: "wellness", label: "Wellness", icon: Heart },
] as const;

type SectionId = (typeof sections)[number]["id"];

function SectionBody({ activeSection }: { activeSection: SectionId }) {
  // Keyed so each switch replays the fade, which reads as a deliberate
  // transition rather than an instant content swap.
  return (
    <div key={activeSection} className="tickd-panel-section">
      {activeSection === "music" && <CreativityPanelPlayer />}
      {activeSection === "notes" && <NotesSection />}
      {activeSection === "inspiration" && <InspirationSection />}
      {activeSection === "goals" && <WeeklyGoals />}
      {activeSection === "wellness" && <WellnessSection />}
    </div>
  );
}

function SectionPills({
  activeSection,
  onSelect,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-pressed={isActive}
            className={`group relative flex min-h-[2.5rem] items-center justify-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 ${
              isActive
                ? "bg-slate-950 text-white shadow-md shadow-slate-950/20"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:ring-slate-300"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                isActive ? "scale-110" : "group-hover:scale-110"
              }`}
            />
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CreativitySidebar({
  isCollapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileOpenChange,
}: CreativitySidebarProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("music");
  const isMobile = useIsMobile();

  // Below the docked breakpoint the panel is presented as a sheet instead of
  // being removed entirely. Weekly goals and creative notes are user data with
  // no other route, so returning null here made them unreachable on phones.
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="right"
          className="flex w-[min(24rem,100vw-2rem)] flex-col gap-0 bg-slate-50 p-0 sm:max-w-none"
        >
          <div className="border-b border-slate-200 bg-white/90 px-4 py-4 pr-14">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="truncate text-base font-semibold text-slate-950">
                  Creative panel
                </SheetTitle>
                <SheetDescription className="truncate text-xs text-slate-500">
                  Focus, ideas, and reset tools
                </SheetDescription>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-white/60 p-3">
            <SectionPills activeSection={activeSection} onSelect={setActiveSection} />
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            <SectionBody activeSection={activeSection} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className={`hidden lg:block fixed right-0 top-0 h-full z-30 transition-[width] duration-500 ease-in-out ${
        isCollapsed ? "w-16" : "w-[21rem]"
      }`}
    >
      {/* Soft vertical wash instead of a flat fill so the panel reads as a
          distinct surface without competing with the tracker. */}
      <div className="absolute inset-0 border-l border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100/80 shadow-[-8px_0_28px_-18px_rgba(15,23,42,0.35)] backdrop-blur" />

      {/* Content */}
      <div className="relative flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white/80 p-4">
          <div className="flex items-center justify-between gap-2">
            {!isCollapsed && (
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-tight text-slate-950">
                    Creative panel
                  </h2>
                  <p className="truncate text-xs text-slate-500">Focus, ideas, and reset tools</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              aria-label={isCollapsed ? "Expand creative panel" : "Collapse creative panel"}
              title={isCollapsed ? "Expand creative panel" : "Collapse creative panel"}
              className="h-9 w-9 shrink-0 rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              {isCollapsed ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Navigation Pills */}
        {!isCollapsed && (
          <div className="border-b border-slate-200 bg-white/60 p-3">
            <SectionPills activeSection={activeSection} onSelect={setActiveSection} />
          </div>
        )}

        {/* Collapsed Navigation Icons */}
        {isCollapsed && (
          <div className="space-y-2 p-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(section.id);
                    onToggle?.();
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-slate-950 text-white shadow-md shadow-slate-950/20"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                  aria-label={`${section.label} — open creative panel`}
                  title={section.label}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        )}

        {/* Content Area */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4">
            <SectionBody activeSection={activeSection} />
          </div>
        )}

        {/* Footer */}
        {!isCollapsed && (
          <div className="border-t border-slate-200 bg-white/80 p-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate">Ready for a focused session</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
