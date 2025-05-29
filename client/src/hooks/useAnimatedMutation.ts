import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface AnimationConfig {
  entryId: number;
  allEntries: any[];
  newData: any;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

export function useAnimatedTimeEntryUpdate() {
  return useMutation({
    mutationFn: async ({ entryId, newData, allEntries, onAnimationStart, onAnimationComplete }: AnimationConfig) => {
      console.log('🎬 Starting animated update for entry:', entryId);
      
      // Check if this update will cause a merge
      const currentEntry = allEntries.find(e => e.id === entryId);
      if (!currentEntry) {
        throw new Error('Current entry not found');
      }
      
      const targetEntry = allEntries.find(entry => 
        entry.id !== entryId &&
        entry.date === currentEntry.date &&
        entry.description?.toLowerCase().trim() === newData.description?.toLowerCase().trim() &&
        entry.projectId === newData.projectId
      );
      
      const willMerge = Boolean(targetEntry);
      console.log('Merge detection:', { willMerge, targetEntryId: targetEntry?.id });
      
      if (willMerge && targetEntry) {
        onAnimationStart?.();
        
        // Find DOM elements
        const currentElement = document.querySelector(`[data-entry-id="${entryId}"]`) as HTMLElement;
        const targetElement = document.querySelector(`[data-entry-id="${targetEntry.id}"]`) as HTMLElement;
        
        if (currentElement && targetElement) {
          console.log('🎯 Playing merge animation...');
          
          // Flash effect
          [currentElement, targetElement].forEach(el => {
            el.style.backgroundColor = '#dbeafe';
            el.style.transition = 'background-color 0.3s ease';
          });
          
          // Slide animation
          const currentRect = currentElement.getBoundingClientRect();
          const targetRect = targetElement.getBoundingClientRect();
          const deltaY = targetRect.top - currentRect.top;
          
          currentElement.style.transform = `translateY(${deltaY}px)`;
          currentElement.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
          currentElement.style.opacity = '0.7';
          
          // Wait for animation
          await new Promise(resolve => setTimeout(resolve, 600));
          
          // Reset styles
          [currentElement, targetElement].forEach(el => {
            el.style.backgroundColor = '';
            el.style.transform = '';
            el.style.opacity = '';
            el.style.transition = '';
          });
        }
      }
      
      // Perform the actual update
      const result = await apiRequest("PUT", `/api/time-entries/${entryId}`, newData);
      
      onAnimationComplete?.();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
    }
  });
}