import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Calendar, Clock, Folder, Users } from "lucide-react";
import { TimeEntryNotes } from "@/components/TimeTracker/TimeEntryNotes";
import { formatDuration } from "@/lib/utils/timeUtils";
import type { TimeEntryNote } from "@shared/schema";

export default function Notes() {
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<number | null>(null);

  // Fetch all time entries with notes
  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['/api/time-entries'],
  });

  // Fetch all notes for the user
  const { data: allNotes = [], isLoading: notesLoading } = useQuery<TimeEntryNote[]>({
    queryKey: ['/api/time-entry-notes'],
  });

  // Group notes by time entry
  const entriesWithNotes = (timeEntries as any[]).filter((entry: any) => 
    allNotes.some(note => note.timeEntryId === entry.id)
  );

  if (entriesLoading || notesLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large floating orb - inspired by the globe */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-20 animate-pulse"
             style={{
               background: 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, rgba(59,130,246,0.3) 35%, rgba(168,85,247,0.2) 70%, transparent 100%)',
               filter: 'blur(1px)'
             }}></div>
        
        {/* Medium flowing shapes */}
        <div className="absolute top-1/3 left-10 w-64 h-64 rounded-full opacity-15 animate-bounce"
             style={{
               background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.3) 0%, rgba(34,197,94,0.2) 50%, transparent 100%)',
               animationDuration: '6s',
               filter: 'blur(2px)'
             }}></div>
        
        {/* Small accent elements */}
        <div className="absolute bottom-1/4 right-1/3 w-32 h-32 rounded-full opacity-25"
             style={{
               background: 'linear-gradient(45deg, rgba(59,130,246,0.4), rgba(147,51,234,0.3))',
               filter: 'blur(1px)'
             }}></div>
        
        {/* Floating particles */}
        <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-ping"></div>
        <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-green-400 rounded-full opacity-40 animate-pulse"></div>
        <div className="absolute bottom-1/3 left-2/3 w-1 h-1 bg-yellow-400 rounded-full opacity-50 animate-bounce"></div>
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
            Creative Notes
          </h1>
          <p className="text-gray-300 text-lg">Your thoughts, ideas, and insights in one inspiring space</p>
        </div>

      {entriesWithNotes.length === 0 ? (
        <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-2xl">
          <CardContent className="text-center py-16">
            <div className="relative">
              <MessageSquare className="h-16 w-16 text-blue-300 mx-auto mb-6 drop-shadow-lg" />
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-blue-400/20 rounded-full blur-xl"></div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Your Creative Space Awaits</h3>
            <p className="text-gray-300 mb-6 text-lg">
              Transform your time entries into meaningful insights with notes.
            </p>
            <p className="text-gray-400">
              Click the notes icon next to any time entry to begin your creative journey.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {entriesWithNotes.map((entry: any) => {
            const entryNotes = allNotes.filter(note => note.timeEntryId === entry.id);
            
            return (
              <Card key={entry.id} className="bg-white/10 backdrop-blur-md border-white/20 shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl mb-3 truncate text-white font-bold">
                        {entry.description || "Untitled Entry"}
                      </CardTitle>
                      <div className="space-y-2 text-sm text-gray-300">
                        {entry.project && (
                          <div className="flex items-center">
                            <Folder className="h-4 w-4 mr-2 text-blue-300" style={{ color: entry.project.color || "#93c5fd" }} />
                            <span className="text-gray-200">{entry.project.name}</span>
                          </div>
                        )}
                        {entry.client && (
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2 text-green-300" />
                            <span className="text-gray-200">{entry.client.name}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-purple-300" />
                          <span className="text-gray-200">{new Date(entry.date || entry.startTime).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-yellow-300" />
                          <span className="text-gray-200">{formatDuration(entry.duration || 0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-white bg-gradient-to-r from-blue-500/30 to-purple-500/30 px-3 py-1 rounded-full backdrop-blur-sm border border-white/20">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {entryNotes.length}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {entryNotes.slice(0, 2).map((note) => (
                      <div key={note.id} className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                        <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed">
                          {note.content}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'No date'}
                        </p>
                      </div>
                    ))}
                    {entryNotes.length > 2 && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        +{entryNotes.length - 2} more notes
                      </p>
                    )}
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <TimeEntryNotes 
                      timeEntryId={entry.id}
                      trigger={
                        <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          View & Edit Notes
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}