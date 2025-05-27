import { useState } from "react";
import { ChevronLeft, ChevronRight, Music, FileText, Lightbulb, Target, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import NewMusicPlayer from "./NewMusicPlayer";
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

  const sections = [
    { id: "music", label: "Music", icon: Music, color: "from-purple-400 to-pink-400" },
    { id: "notes", label: "Notes", icon: FileText, color: "from-blue-400 to-cyan-400" },
    { id: "inspiration", label: "Inspire", icon: Lightbulb, color: "from-yellow-400 to-orange-400" },
    { id: "goals", label: "Goals", icon: Target, color: "from-green-400 to-emerald-400" },
    { id: "wellness", label: "Wellness", icon: Heart, color: "from-red-400 to-pink-400" },
  ];

  return (
    <div className={`fixed right-0 top-0 h-full z-30 transition-all duration-500 ease-in-out ${
      isCollapsed ? 'w-16' : 'w-80'
    }`}>
      {/* Background with glassmorphism effect */}
      <div className="absolute inset-0 backdrop-blur-xl bg-white/10 border-l border-white/20">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-tickd-primary/20 via-tickd-secondary/20 to-purple-400/20 animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-tl from-pink-400/10 via-transparent to-blue-400/10"></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 tickd-primary animate-pulse" />
                <h2 className="text-lg font-bold bg-gradient-to-r from-tickd-primary to-tickd-secondary bg-clip-text text-transparent">
                  Creativity Space
                </h2>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="text-gray-700 hover:bg-white/20 transition-all duration-300"
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
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-full transition-all duration-300 transform hover:scale-105 ${
                      isActive
                        ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                        : 'bg-white/20 text-gray-700 hover:bg-white/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsed Navigation Icons */}
        {isCollapsed && (
          <div className="p-2 space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 transform hover:scale-110 ${
                    isActive
                      ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                      : 'bg-white/20 text-gray-700 hover:bg-white/30'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        )}

        {/* Content Area */}
        {!isCollapsed && (
          <div className="flex-1 p-4 overflow-y-auto">
            {activeSection === "music" && <NewMusicPlayer />}
            {activeSection === "notes" && <NotesSection />}
            {activeSection === "inspiration" && <InspirationSection />}
            {activeSection === "goals" && <WeeklyGoals />}
            {activeSection === "wellness" && <WellnessSection />}
          </div>
        )}

        {/* Footer with floating action */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/20">
            <div className="text-center">
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-tickd-primary to-tickd-secondary rounded-full text-white text-sm font-medium shadow-lg">
                <Sparkles className="w-4 h-4" />
                <span>Boost Your Creativity</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}