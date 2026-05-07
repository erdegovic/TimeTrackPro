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

  const { data: timeEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['/api/time-entries'],
  });

  const { data: allNotes = [], isLoading: notesLoading } = useQuery<TimeEntryNote[]>({
    queryKey: ['/api/time-entry-notes'],
  });

  const entriesWithNotes = (timeEntries as any[]).filter((entry: any) =>
    allNotes.some(note => note.timeEntryId === entry.id)
  );

  if (entriesLoading || notesLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Notes</h1>
        <p className="text-sm text-gray-500">Notes attached to your tracked time entries</p>
      </div>

      {entriesWithNotes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 px-4">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No notes yet</h3>
            <p className="text-sm text-gray-500">
              Click the notes icon next to any time entry in the tracker to add your first note.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {entriesWithNotes.map((entry: any) => {
            const entryNotes = allNotes.filter(note => note.timeEntryId === entry.id);

            return (
              <Card key={entry.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 px-4 pt-4 sm:px-5 sm:pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm sm:text-base leading-snug flex-1 min-w-0 truncate">
                      {entry.description || "Untitled Entry"}
                    </CardTitle>
                    <span className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      <MessageSquare className="h-3 w-3" />
                      {entryNotes.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                    {entry.project && (
                      <span className="flex items-center gap-1">
                        <Folder className="h-3 w-3 flex-shrink-0" style={{ color: entry.project.color || "#6b7280" }} />
                        {entry.project.name}
                      </span>
                    )}
                    {entry.client && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 flex-shrink-0 text-gray-400" />
                        {entry.client.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 flex-shrink-0 text-gray-400" />
                      {new Date(entry.date || entry.startTime).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0 text-gray-400" />
                      {formatDuration(entry.duration || 0)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0 px-4 pb-4 sm:px-5 sm:pb-5">
                  <div className="space-y-2 flex-1">
                    {entryNotes.slice(0, 2).map((note) => (
                      <div key={note.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-800 line-clamp-3 leading-relaxed">
                          {note.content}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    ))}
                    {entryNotes.length > 2 && (
                      <p className="text-xs text-gray-400 text-center py-1">
                        +{entryNotes.length - 2} more
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <TimeEntryNotes
                      timeEntryId={entry.id}
                      trigger={
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">
                          <MessageSquare className="h-3 w-3 mr-1.5" />
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
  );
}
