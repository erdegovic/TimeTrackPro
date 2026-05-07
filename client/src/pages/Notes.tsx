import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Calendar, Clock, Folder, Users, Pin, Tag, StickyNote } from "lucide-react";
import { TimeEntryNotes } from "@/components/TimeTracker/TimeEntryNotes";
import { formatDuration } from "@/lib/utils/timeUtils";
import type { TimeEntryNote, CreativityNote } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryColors: Record<string, string> = {
  ideas: "bg-yellow-100 text-yellow-800 border-yellow-200",
  goals: "bg-green-100 text-green-800 border-green-200",
  inspirations: "bg-purple-100 text-purple-800 border-purple-200",
  meeting: "bg-blue-100 text-blue-800 border-blue-200",
  personal: "bg-red-100 text-red-800 border-red-200",
};

const categoryLabels: Record<string, string> = {
  ideas: "Ideas",
  goals: "Goals",
  inspirations: "Inspirations",
  meeting: "Meeting Notes",
  personal: "Personal",
};

export default function Notes() {
  const { toast } = useToast();
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<number | null>(null);

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['/api/time-entries'],
  });

  const { data: allNotes = [], isLoading: notesLoading } = useQuery<TimeEntryNote[]>({
    queryKey: ['/api/time-entry-notes'],
  });

  const { data: creativityNotes = [], isLoading: creativityLoading } = useQuery<CreativityNote[]>({
    queryKey: ['/api/creativity/notes'],
  });

  const deleteCreativityNote = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/creativity/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creativity/notes'] });
      toast({ title: "Note deleted" });
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, isPinned }: { id: number; isPinned: boolean }) => {
      const res = await apiRequest("PUT", `/api/creativity/notes/${id}`, { isPinned });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/creativity/notes'] });
    },
  });

  const entriesWithNotes = (timeEntries as any[]).filter((entry: any) =>
    allNotes.some(note => note.timeEntryId === entry.id)
  );

  const pinnedNotes = creativityNotes.filter(n => n.isPinned);
  const unpinnedNotes = creativityNotes.filter(n => !n.isPinned);
  const sortedCreativityNotes = [...pinnedNotes, ...unpinnedNotes];

  if (entriesLoading || notesLoading || creativityLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-48 sm:h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">

      {/* Creativity / Sidebar Notes */}
      <div>
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Notes</h1>
          <p className="text-sm sm:text-base text-gray-600">Notes you've created from the sidebar, organised by category</p>
        </div>

        {sortedCreativityNotes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 sm:py-12 px-4">
              <StickyNote className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No sidebar notes yet</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Open the creativity panel on the right side to create your first note.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {sortedCreativityNotes.map((note) => {
              const colorClass = categoryColors[note.category || "ideas"] || categoryColors.ideas;
              const categoryLabel = categoryLabels[note.category || "ideas"] || note.category;
              return (
                <Card key={note.id} className={`hover:shadow-lg transition-shadow ${note.isPinned ? "ring-2 ring-primary/30" : ""}`}>
                  <CardHeader className="pb-2 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg leading-snug flex-1">
                        {note.title || "Untitled"}
                      </CardTitle>
                      <button
                        onClick={() => togglePin.mutate({ id: note.id, isPinned: !note.isPinned })}
                        className={`flex-shrink-0 p-1 rounded transition-colors ${note.isPinned ? "text-primary" : "text-gray-300 hover:text-gray-500"}`}
                        title={note.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin className="h-4 w-4" />
                      </button>
                    </div>
                    <Badge variant="outline" className={`text-xs w-fit ${colorClass}`}>
                      {categoryLabel}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-0 p-4 sm:p-6">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4 mb-3">
                      {note.content}
                    </p>
                    {note.tags && (
                      <div className="flex items-center gap-1 flex-wrap mb-3">
                        <Tag className="h-3 w-3 text-gray-400" />
                        {note.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ""}
                      </span>
                      <button
                        onClick={() => deleteCreativityNote.mutate(note.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Entry Notes */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Time Entry Notes</h2>
          <p className="text-sm text-gray-500">Notes attached to your tracked time entries</p>
        </div>

        {entriesWithNotes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 px-4">
              <MessageSquare className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No time entry notes yet</h3>
              <p className="text-sm text-gray-600">
                Click the notes icon next to any time entry in the tracker to add a note.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {entriesWithNotes.map((entry: any) => {
              const entryNotes = allNotes.filter(note => note.timeEntryId === entry.id);
              return (
                <Card key={entry.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg mb-2 truncate">
                          {entry.description || "Untitled Entry"}
                        </CardTitle>
                        <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                          {entry.project && (
                            <div className="flex items-center">
                              <Folder className="h-4 w-4 mr-2" style={{ color: entry.project.color || "#6b7280" }} />
                              <span>{entry.project.name}</span>
                            </div>
                          )}
                          {entry.client && (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-2 text-gray-400" />
                              <span>{entry.client.name}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            <span>{new Date(entry.date || entry.startTime).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-gray-400" />
                            <span>{formatDuration(entry.duration || 0)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded flex-shrink-0">
                        <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        {entryNotes.length}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 p-4 sm:p-6">
                    <div className="space-y-2 sm:space-y-3">
                      {entryNotes.slice(0, 2).map((note) => (
                        <div key={note.id} className="p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-800 line-clamp-2 sm:line-clamp-3">
                            {note.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'No date'}
                          </p>
                        </div>
                      ))}
                      {entryNotes.length > 2 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{entryNotes.length - 2} more notes
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t">
                      <TimeEntryNotes
                        timeEntryId={entry.id}
                        trigger={
                          <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
                            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            <span className="hidden sm:inline">View & Edit Notes</span>
                            <span className="sm:hidden">Notes</span>
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
