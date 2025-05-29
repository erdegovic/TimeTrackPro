import { useCallback } from 'react';
import { TimeEntry, Client, Project } from '@shared/schema';

interface MergeAnimationOptions {
  currentEntry: TimeEntry & { client?: Client; project?: Project };
  allEntries: Array<TimeEntry & { client?: Client; project?: Project }>;
  onAnimationComplete?: () => void;
}

export function useMergeAnimation() {
  const detectAndAnimateMerge = useCallback(async (options: MergeAnimationOptions) => {
    const { currentEntry, allEntries, onAnimationComplete } = options;
    
    console.log('🔍 Starting merge detection for entry:', currentEntry.id);
    console.log('📋 Checking against', allEntries.length, 'total entries');
    
    // Find potential merge target
    const targetEntry = allEntries.find(entry => 
      entry.id !== currentEntry.id &&
      entry.date === currentEntry.date &&
      entry.description === currentEntry.description &&
      entry.projectId === currentEntry.projectId
    );
    
    if (!targetEntry) {
      console.log('❌ No merge target found');
      return false;
    }
    
    console.log('🎯 MERGE TARGET FOUND!', {
      current: { id: currentEntry.id, description: currentEntry.description },
      target: { id: targetEntry.id, description: targetEntry.description }
    });
    
    // Find DOM elements
    const currentElement = document.querySelector(`[data-entry-id="${currentEntry.id}"]`) as HTMLElement;
    const targetElement = document.querySelector(`[data-entry-id="${targetEntry.id}"]`) as HTMLElement;
    
    if (!currentElement || !targetElement) {
      console.log('❌ Could not find DOM elements for animation');
      return false;
    }
    
    console.log('🎬 Starting merge animation...');
    
    // Add flash effect to both elements
    [currentElement, targetElement].forEach(el => {
      el.style.backgroundColor = '#dbeafe'; // blue-100
      el.style.transition = 'background-color 0.3s ease';
    });
    
    // Calculate slide distance
    const currentRect = currentElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const deltaY = targetRect.top - currentRect.top;
    
    console.log('📐 Animation positions:', {
      currentY: currentRect.top,
      targetY: targetRect.top,
      deltaY
    });
    
    // Apply slide animation to current element
    currentElement.style.transform = `translateY(${deltaY}px)`;
    currentElement.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    currentElement.style.opacity = '0.7';
    
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Reset styles
    [currentElement, targetElement].forEach(el => {
      el.style.backgroundColor = '';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = '';
    });
    
    console.log('✅ Merge animation completed');
    
    if (onAnimationComplete) {
      onAnimationComplete();
    }
    
    return true;
  }, []);
  
  return { detectAndAnimateMerge };
}