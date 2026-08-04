import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus, Edit2, Trash2, Save, X, MessageSquare, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import type { TimeEntryNote } from '@shared/schema';

type SpeechRecognitionResultEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

// TypeScript declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface TimeEntryNotesProps {
  timeEntryId: number;
  trigger?: React.ReactNode;
}

// Smart notes button that checks if notes exist and styles accordingly
export function NotesButton({ timeEntryId }: { timeEntryId: number }) {
  const { data: notes = [] } = useQuery<TimeEntryNote[]>({
    queryKey: [`/api/time-entries/${timeEntryId}/notes`],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const hasNotes = notes.length > 0;

  return (
    <TimeEntryNotes 
      timeEntryId={timeEntryId}
      trigger={
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-8 w-8 ${
            hasNotes 
              ? 'text-orange-600 hover:text-white hover:bg-orange-600' 
              : 'text-orange-500 hover:text-white hover:bg-orange-500'
          }`}
          title={hasNotes ? "View notes" : "Add note"}
        >
          <MessageSquare className={`h-4 w-4 ${hasNotes ? 'fill-current opacity-70' : ''}`} />
        </Button>
      }
    />
  );
}

export function TimeEntryNotes({ timeEntryId, trigger }: TimeEntryNotesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognitionInstance | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery<TimeEntryNote[]>({
    queryKey: [`/api/time-entries/${timeEntryId}/notes`],
    enabled: isOpen,
  });

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) return;
      const recognition = new SpeechRecognitionCtor();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const processedText = addSmartPunctuation(transcript);
        setNewNoteContent(prev => prev + (prev ? ' ' : '') + processedText);
        setIsRecording(false);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        toast({
          title: "Voice recording failed",
          description: "Please try again or check your microphone permissions.",
          variant: "destructive",
        });
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognition);
    }
  }, [toast]);

  // Smart punctuation processing for speech-to-text
  const addSmartPunctuation = (text: string): string => {
    let processed = text.trim();
    
    // Capitalize first letter
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    
    // Add periods after common sentence endings
    processed = processed.replace(/\b(done|finished|completed|ready|good|great|ok|okay|yes|no)$/i, '$1.');
    
    // Add commas after common pause words
    processed = processed.replace(/\b(however|therefore|meanwhile|furthermore|moreover|also|additionally|first|second|third|next|then|finally|lastly|actually|basically|obviously|clearly|definitely|probably|maybe|perhaps|anyway|so|well|now|today|yesterday|tomorrow|later|earlier|before|after|during|while|when|if|although|because|since|unless|until|though|whereas)\b/gi, '$1,');
    
    // Add commas in lists (word and word and word)
    processed = processed.replace(/(\w+)\s+and\s+(\w+)\s+and\s+/g, '$1, $2, and ');
    
    // Add period at the end if missing and doesn't end with punctuation
    if (!/[.!?:]$/.test(processed)) {
      processed += '.';
    }
    
    // Clean up any double punctuation
    processed = processed.replace(/[,]{2,}/g, ',');
    processed = processed.replace(/[.]{2,}/g, '.');
    
    return processed;
  };

  const startRecording = () => {
    if (recognition && !isRecording) {
      setIsRecording(true);
      recognition.start();
    } else if (!recognition) {
      toast({
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', `/api/time-entries/${timeEntryId}/notes`, { content });
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
      return apiRequest('PUT', `/api/time-entry-notes/${id}`, { content });
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
      return apiRequest('DELETE', `/api/time-entry-notes/${id}`);
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
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write your note..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="min-h-[80px] flex-1"
                />
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  className="h-10 w-10 p-0 self-start mt-1"
                  disabled={!recognition}
                  title={isRecording ? "Stop recording" : "Start voice recording"}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              {isRecording && (
                <div className="text-sm text-orange-600 animate-pulse">
                  Listening... Speak now
                </div>
              )}
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
