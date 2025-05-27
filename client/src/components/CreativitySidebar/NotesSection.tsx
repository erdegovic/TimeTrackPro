import { useState, useEffect } from "react";
import { Plus, Search, Tag, Pin, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreativityNote, InsertCreativityNote } from "@shared/schema";

const categories = [
  { id: "ideas", label: "Ideas", color: "from-yellow-400 to-orange-400", emoji: "💡" },
  { id: "goals", label: "Goals", color: "from-green-400 to-emerald-400", emoji: "🎯" },
  { id: "inspirations", label: "Inspirations", color: "from-purple-400 to-pink-400", emoji: "✨" },
  { id: "meeting", label: "Meeting Notes", color: "from-blue-400 to-cyan-400", emoji: "📝" },
  { id: "personal", label: "Personal", color: "from-red-400 to-pink-400", emoji: "❤️" },
];

export default function NotesSection() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<CreativityNote | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const [newNote, setNewNote] = useState<Partial<InsertCreativityNote>>({
    title: "",
    content: "",
    category: "ideas",
    tags: "",
    isPinned: false,
  });

  // Fetch notes
  const { data: notes = [], isLoading } = useQuery<CreativityNote[]>({
    queryKey: ["/api/creativity/notes"],
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: InsertCreativityNote) => {
      const res = await apiRequest("POST", "/api/creativity/notes", noteData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creativity/notes"] });
      setIsCreating(false);
      setNewNote({ title: "", content: "", category: "ideas", tags: "", isPinned: false });
      toast({ title: "Note created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create note", variant: "destructive" });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, ...noteData }: Partial<CreativityNote> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/creativity/notes/${id}`, noteData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creativity/notes"] });
      setEditingNote(null);
      toast({ title: "Note updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/creativity/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creativity/notes"] });
      toast({ title: "Note deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.tags?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSaveNote = () => {
    if (!newNote.content?.trim()) return;
    
    createNoteMutation.mutate({
      title: newNote.title || "Untitled",
      content: newNote.content,
      category: newNote.category || "ideas",
      tags: newNote.tags,
      isPinned: newNote.isPinned || false,
      userId: 1, // Will be set by backend based on auth
    });
  };

  const handleUpdateNote = () => {
    if (!editingNote || !editingNote.content?.trim()) return;
    
    updateNoteMutation.mutate(editingNote);
  };

  const togglePin = (note: CreativityNote) => {
    updateNoteMutation.mutate({
      ...note,
      isPinned: !note.isPinned,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-tickd-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tickd-text">Notes</h3>
        <Button
          onClick={() => setIsCreating(true)}
          size="sm"
          className="tickd-bg-primary text-white hover:scale-105 transition-transform"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.emoji} {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <div className="tickd-card p-4 space-y-3 bg-gradient-to-r from-white/90 to-white/70">
          <Input
            placeholder="Note title..."
            value={newNote.title || ""}
            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
          />
          
          <Textarea
            placeholder="What's on your mind?"
            value={newNote.content || ""}
            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
            className="min-h-[80px]"
          />
          
          <div className="flex items-center space-x-2">
            <Select
              value={newNote.category}
              onValueChange={(value) => setNewNote({ ...newNote, category: value })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input
              placeholder="Tags (comma separated)"
              value={newNote.tags || ""}
              onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
              className="flex-1"
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setNewNote({ title: "", content: "", category: "ideas", tags: "", isPinned: false });
              }}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNote}
              disabled={createNoteMutation.isPending}
              className="tickd-bg-primary text-white"
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="text-center p-8 tickd-light-text">
            <div className="text-4xl mb-2">📝</div>
            <p>No notes yet. Start capturing your ideas!</p>
          </div>
        ) : (
          filteredNotes
            .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
            .map((note) => {
              const category = categories.find(cat => cat.id === note.category);
              const isEditing = editingNote?.id === note.id;
              
              return (
                <div
                  key={note.id}
                  className={`tickd-card p-3 hover:shadow-md transition-all duration-200 ${
                    note.isPinned ? 'border-l-4 tickd-border-primary bg-gradient-to-r from-white/90 to-blue-50/50' : 'bg-white/60'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editingNote.title || ""}
                        onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                      />
                      <Textarea
                        value={editingNote.content}
                        onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                        className="min-h-[60px]"
                      />
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingNote(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={handleUpdateNote} className="tickd-bg-primary text-white">
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {category && (
                            <span className="text-sm">{category.emoji}</span>
                          )}
                          <h4 className="font-medium text-sm truncate">
                            {note.title || "Untitled"}
                          </h4>
                          {note.isPinned && (
                            <Pin className="w-3 h-3 tickd-primary" />
                          )}
                        </div>
                        
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => togglePin(note)}
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pin className={`w-3 h-3 ${note.isPinned ? 'tickd-primary' : 'text-gray-400'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingNote(note)}
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 line-clamp-3 mb-2">
                        {note.content}
                      </p>
                      
                      {note.tags && (
                        <div className="flex flex-wrap gap-1">
                          {note.tags.split(',').map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-xs rounded-full tickd-light-text"
                            >
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="text-xs tickd-light-text mt-2">
                        {new Date(note.createdAt || '').toLocaleDateString()}
                      </div>
                    </>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}