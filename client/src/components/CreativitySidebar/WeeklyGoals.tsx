import { useState } from "react";
import { Plus, Target, Check, Clock, Trash2, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WeeklyGoal, InsertWeeklyGoal } from "@shared/schema";
import { format, startOfWeek, endOfWeek } from "date-fns";

const priorities = [
  { id: "high", label: "High", color: "from-red-400 to-red-600", emoji: "🔥" },
  { id: "medium", label: "Medium", color: "from-yellow-400 to-orange-500", emoji: "⚡" },
  { id: "low", label: "Low", color: "from-green-400 to-green-600", emoji: "🌱" },
];

export default function WeeklyGoals() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WeeklyGoal | null>(null);
  
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  
  const [newGoal, setNewGoal] = useState<Partial<InsertWeeklyGoal>>({
    title: "",
    description: "",
    priority: "medium",
    weekOf: currentWeekStart,
  });

  // Fetch goals for current week
  const { data: allGoals = [], isLoading } = useQuery<WeeklyGoal[]>({
    queryKey: ["/api/creativity/goals", currentWeekStart],
  });

  const goals = allGoals.filter((goal) => String(goal.weekOf || "").slice(0, 10) === currentWeekStart);

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: InsertWeeklyGoal) => {
      const res = await apiRequest("POST", "/api/creativity/goals", goalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creativity/goals"] });
      setIsCreating(false);
      setNewGoal({ title: "", description: "", priority: "medium", weekOf: currentWeekStart });
      toast({ title: "Goal added successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create goal", variant: "destructive" });
    },
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, ...goalData }: Partial<WeeklyGoal> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/creativity/goals/${id}`, goalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creativity/goals"] });
      setEditingGoal(null);
      toast({ title: "Goal updated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to update goal", variant: "destructive" });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/creativity/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creativity/goals"] });
      toast({ title: "Goal deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete goal", variant: "destructive" });
    },
  });

  const handleSaveGoal = () => {
    if (!newGoal.title?.trim()) return;
    
    createGoalMutation.mutate({
      title: newGoal.title,
      description: newGoal.description,
      priority: newGoal.priority || "medium",
      weekOf: currentWeekStart,
      userId: 2, // Current user ID
      isCompleted: false,
    });
  };

  const handleUpdateGoal = () => {
    if (!editingGoal || !editingGoal.title?.trim()) return;
    updateGoalMutation.mutate(editingGoal);
  };

  const toggleComplete = (goal: WeeklyGoal) => {
    updateGoalMutation.mutate({
      ...goal,
      isCompleted: !goal.isCompleted,
      completedAt: !goal.isCompleted ? new Date() : null,
    });
  };

  const completedGoals = goals.filter(g => g.isCompleted).length;
  const totalGoals = goals.length;
  const completionPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-tickd-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="tickd-card p-4 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold tickd-text">This Week's Goals</h3>
            <p className="text-sm tickd-light-text">{weekStart} - {weekEnd}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tickd-secondary">{completedGoals}/{totalGoals}</div>
            <div className="text-xs tickd-light-text">completed</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-gradient-to-r from-tickd-secondary to-green-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
        <div className="text-center text-sm font-medium tickd-secondary">{completionPercentage}% Complete</div>
        
        {completionPercentage === 100 && totalGoals > 0 && (
          <div className="mt-2 text-center">
            <div className="text-2xl">🎉</div>
            <div className="text-sm font-medium tickd-secondary">Week completed! Amazing work!</div>
          </div>
        )}
      </div>

      {/* Add Goal Button */}
      <Button
        onClick={() => setIsCreating(true)}
        className="w-full tickd-bg-primary text-white hover:scale-105 transition-transform"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Weekly Goal
      </Button>

      {/* Create Goal Form */}
      {isCreating && (
        <div className="tickd-card p-4 space-y-3 bg-gradient-to-r from-white/90 to-white/70">
          <Input
            placeholder="What do you want to accomplish this week?"
            value={newGoal.title || ""}
            onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
          />
          
          <Textarea
            placeholder="Add details or break it down into steps..."
            value={newGoal.description || ""}
            onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
            className="min-h-[60px]"
          />
          
          <Select
            value={newGoal.priority || "medium"}
            onValueChange={(value) => setNewGoal({ ...newGoal, priority: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((priority) => (
                <SelectItem key={priority.id} value={priority.id}>
                  {priority.emoji} {priority.label} Priority
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreating(false);
                setNewGoal({ title: "", description: "", priority: "medium", weekOf: currentWeekStart });
              }}
              title="Cancel new goal"
              aria-label="Cancel new goal"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSaveGoal}
              disabled={createGoalMutation.isPending}
              className="tickd-bg-primary text-white"
              title="Save goal"
              aria-label="Save goal"
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {goals.length === 0 ? (
          <div className="text-center p-8 tickd-light-text">
            <div className="text-4xl mb-2">🎯</div>
            <p>No goals set for this week yet.</p>
            <p className="text-xs mt-1">Set your weekly goals to stay focused!</p>
          </div>
        ) : (
          goals
            .sort((a, b) => {
              // Sort by: incomplete first, then by priority, then by creation date
              if (a.isCompleted !== b.isCompleted) {
                return a.isCompleted ? 1 : -1;
              }
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                     (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
            })
            .map((goal) => {
              const priority = priorities.find(p => p.id === goal.priority);
              const isEditing = editingGoal?.id === goal.id;
              
              return (
                <div
                  key={goal.id}
                  className={`tickd-card p-3 hover:shadow-md transition-all duration-200 group ${
                    goal.isCompleted 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 opacity-75' 
                      : 'bg-white/80'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editingGoal.title}
                        onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                      />
                      <Textarea
                        value={editingGoal.description || ""}
                        onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value })}
                        className="min-h-[60px]"
                      />
                      <Select
                        value={editingGoal.priority || "medium"}
                        onValueChange={(value) => setEditingGoal({ ...editingGoal, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority.id} value={priority.id}>
                              {priority.emoji} {priority.label} Priority
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingGoal(null)} title="Cancel goal edit" aria-label="Cancel goal edit">
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={handleUpdateGoal} className="tickd-bg-primary text-white" title="Save goal changes" aria-label="Save goal changes">
                          <Save className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start space-x-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleComplete(goal)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            goal.isCompleted
                              ? 'tickd-bg-secondary border-green-500 text-white'
                              : 'border-gray-300 hover:border-tickd-primary'
                          }`}
                          title={goal.isCompleted ? "Mark goal incomplete" : "Mark goal complete"}
                          aria-label={goal.isCompleted ? "Mark goal incomplete" : "Mark goal complete"}
                        >
                          {goal.isCompleted && <Check className="w-3 h-3" />}
                        </Button>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {priority && (
                              <span className="text-sm">{priority.emoji}</span>
                            )}
                            <h4 className={`font-medium text-sm ${goal.isCompleted ? 'line-through tickd-light-text' : 'tickd-text'}`}>
                              {goal.title}
                            </h4>
                          </div>
                          
                          {goal.description && (
                            <p className={`text-xs ${goal.isCompleted ? 'line-through tickd-light-text' : 'text-gray-600'} mb-2`}>
                              {goal.description}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {priority && (
                                <span className={`px-2 py-1 text-xs rounded-full bg-gradient-to-r ${priority.color} text-white`}>
                                  {priority.label}
                                </span>
                              )}
                              {goal.isCompleted && goal.completedAt && (
                                <span className="text-xs tickd-light-text flex items-center">
                                  <Check className="w-3 h-3 mr-1" />
                                  {new Date(goal.completedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingGoal(goal)}
                                className="w-6 h-6"
                                title="Edit goal"
                                aria-label="Edit goal"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteGoalMutation.mutate(goal.id)}
                                className="w-6 h-6 hover:text-red-500"
                                title="Delete goal"
                                aria-label="Delete goal"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Motivational Quote */}
      <div className="text-center p-3 bg-gradient-to-r from-tickd-primary/10 to-tickd-secondary/10 rounded-lg">
        <p className="text-sm tickd-primary font-medium">
          "Success is the sum of small efforts repeated day in and day out."
        </p>
      </div>
    </div>
  );
}
