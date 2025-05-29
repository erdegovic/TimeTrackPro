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
  const entriesWithNotes = timeEntries.filter((entry: any) => 
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notes</h1>
        <p className="text-gray-600">View and manage all your time entry notes in one place</p>
      </div>

      {entriesWithNotes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
            <p className="text-gray-600 mb-4">
              Start adding notes to your time entries to see them here.
            </p>
            <p className="text-sm text-gray-500">
              Click the notes icon next to any time entry to add your first note.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {entriesWithNotes.map((entry: any) => {
            const entryNotes = allNotes.filter(note => note.timeEntryId === entry.id);
            
            return (
              <Card key={entry.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2 truncate">
                        {entry.description || "Untitled Entry"}
                      </CardTitle>
                      <div className="space-y-1 text-sm text-gray-600">
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
                          <span>{new Date(entry.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{formatDuration(entry.duration || 0)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {entryNotes.length}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {entryNotes.slice(0, 2).map((note) => (
                      <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-800 line-clamp-3">
                          {note.content}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(note.createdAt).toLocaleString()}
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
                        <Button variant="outline" size="sm" className="w-full">
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
  );
}