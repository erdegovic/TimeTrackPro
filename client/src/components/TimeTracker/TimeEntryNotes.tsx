import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import type { TimeEntryNote } from '@shared/schema';

interface TimeEntryNotesProps {
  timeEntryId: number;
  trigger?: React.ReactNode;
}

export function TimeEntryNotes({ timeEntryId, trigger }: TimeEntryNotesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: [`/api/time-entries/${timeEntryId}/notes`],
    enabled: isOpen,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/time-entries/${timeEntryId}/notes`, {
        method: 'POST',
        body: { content },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/${timeEntryId}/notes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entry-notes'] });
      setNewNoteContent('');
      toast({
        title: 'Note added',
        description: 'Your note has been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save note. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      return apiRequest(`/api/time-entry-notes/${id}`, {
        method: 'PUT',
        body: { content },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/${timeEntryId}/notes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entry-notes'] });
      setEditingNoteId(null);
      setEditingContent('');
      toast({
        title: 'Note updated',
        description: 'Your note has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update note. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/time-entry-notes/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/time-entries/${timeEntryId}/notes`] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entry-notes'] });
      toast({
        title: 'Note deleted',
        description: 'Your note has been deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete note. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateNote = () => {
    if (newNoteContent.trim()) {
      createNoteMutation.mutate(newNoteContent.trim());
    }
  };

  const handleStartEdit = (note: TimeEntryNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const handleSaveEdit = () => {
    if (editingNoteId && editingContent.trim()) {
      updateNoteMutation.mutate({
        id: editingNoteId,
        content: editingContent.trim(),
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleDeleteNote = (id: number) => {
    if (confirm('Are you sure you want to delete this note?')) {
      deleteNoteMutation.mutate(id);
    }
  };

  const hasNotes = notes.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${hasNotes ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FileText className={`h-4 w-4 ${hasNotes ? 'animate-pulse' : ''}`} />
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Time Entry Notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new note */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Note
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Write your note..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="min-h-[80px]"
              />
              <Button
                onClick={handleCreateNote}
                disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                className="w-full"
              >
                {createNoteMutation.isPending ? 'Saving...' : 'Add Note'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing notes */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notes yet. Add your first note above.
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note: TimeEntryNote) => (
                <Card key={note.id} className="relative">
                  <CardContent className="pt-4">
                    {editingNoteId === note.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={!editingContent.trim() || updateNoteMutation.isPending}
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap mb-2">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            {note.createdAt ? format(new Date(note.createdAt), 'MMM d, yyyy h:mm a') : ''}
                            {note.updatedAt && note.updatedAt !== note.createdAt && ' (edited)'}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(note)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteNote(note.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}