import { useState } from "react";
import { ChevronLeft, ChevronRight, Music, FileText, Lightbulb, Target, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import CreativityPanelPlayer from "./SpotifyStylePlayer";
import NotesSection from "./NotesSection";
import InspirationSection from "./InspirationSection";
import WeeklyGoals from "./WeeklyGoals";
import WellnessSection from "./WellnessSection";

interface CreativitySidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function CreativitySidebar({ isCollapsed = false, onToggle }: CreativitySidebarProps) {
  const [activeSection, setActiveSection] = useState<string>("music");
  const isMobile = useIsMobile();

  // Hide creativity sidebar on mobile devices
  if (isMobile) {
    return null;
  }

  const sections = [
    { id: "music", label: "Music", icon: Music },
    { id: "notes", label: "Notes", icon: FileText },
    { id: "inspiration", label: "Inspire", icon: Lightbulb },
    { id: "goals", label: "Goals", icon: Target },
    { id: "wellness", label: "Wellness", icon: Heart },
  ];

  return (
    <div className={`hidden lg:block fixed right-0 top-0 h-full z-30 transition-all duration-500 ease-in-out ${
      isCollapsed ? 'w-16' : 'w-[21rem]'
    }`}>
      <div className="absolute inset-0 border-l border-slate-200 bg-slate-50/95 shadow-xl backdrop-blur" />

      {/* Content */}
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white/80 p-4">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Creative panel</h2>
                  <p className="text-xs text-slate-500">Focus, ideas, and reset tools</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="rounded-md text-slate-600 hover:bg-slate-100"
            >
              {isCollapsed ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Navigation Pills */}
        {!isCollapsed && (
          <div className="border-b border-slate-200 bg-white/60 p-3">
            <div className="grid grid-cols-2 gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
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
                  onClick={() => setActiveSection(section.id)}
                  className={`flex h-12 w-12 items-center justify-center rounded-lg transition ${
                    isActive
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                  aria-label={section.label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        )}

        {/* Content Area */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === "music" && <CreativityPanelPlayer />}
            {activeSection === "notes" && <NotesSection />}
            {activeSection === "inspiration" && <InspirationSection />}
            {activeSection === "goals" && <WeeklyGoals />}
            {activeSection === "wellness" && <WellnessSection />}
          </div>
        )}

        {/* Footer with floating action */}
        {!isCollapsed && (
          <div className="border-t border-slate-200 bg-white/80 p-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Ready for a focused session
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
