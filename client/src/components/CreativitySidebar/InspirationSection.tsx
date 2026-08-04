import { useState, useEffect } from "react";
import { Lightbulb, RefreshCw, Palette, Sparkles, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

const inspirationalQuotes = [
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
    category: "action"
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs", 
    category: "innovation"
  },
  {
    text: "Your limitation—it's only your imagination.",
    author: "Unknown",
    category: "mindset"
  },
  {
    text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
    category: "perseverance"
  },
  {
    text: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
    category: "dreams"
  },
  {
    text: "Creativity is intelligence having fun.",
    author: "Albert Einstein",
    category: "creativity"
  }
];

const creativePrompts = [
  "If you could solve any problem in the world, what would it be?",
  "Describe your perfect workday in 3 words.",
  "What would you create if you knew you couldn't fail?",
  "Write about a time when you felt most creative.",
  "What's one skill you'd love to master this year?",
  "Imagine your work in 5 years. What does it look like?",
  "What inspires you most about your current project?",
  "If you had unlimited resources, what would you build?",
  "What's the most valuable lesson you learned recently?",
  "How would you explain your passion to a 5-year-old?"
];

const colorPalettes = [
  {
    name: "Ocean Breeze",
    colors: ["#e0f7fa", "#81d4fa", "#29b6f6", "#0277bd", "#01579b"],
    mood: "Calm & Focused"
  },
  {
    name: "Sunset Glow",
    colors: ["#fff3e0", "#ffcc80", "#ff9800", "#ef6c00", "#e65100"],
    mood: "Warm & Energetic"
  },
  {
    name: "Forest Deep", 
    colors: ["#e8f5e8", "#a5d6a7", "#66bb6a", "#388e3c", "#1b5e20"],
    mood: "Natural & Grounded"
  },
  {
    name: "Purple Dreams",
    colors: ["#f3e5f5", "#ce93d8", "#ab47bc", "#7b1fa2", "#4a148c"],
    mood: "Creative & Mystical"
  },
  {
    name: "Modern Minimal",
    colors: ["#fafafa", "#e0e0e0", "#9e9e9e", "#424242", "#212121"],
    mood: "Clean & Professional"
  }
];

export default function InspirationSection() {
  const [currentQuote, setCurrentQuote] = useState(inspirationalQuotes[0]);
  const [currentPrompt, setCurrentPrompt] = useState(creativePrompts[0]);
  const [currentPalette, setCurrentPalette] = useState(colorPalettes[0]);

  useEffect(() => {
    // Set random initial content
    setCurrentQuote(inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)]);
    setCurrentPrompt(creativePrompts[Math.floor(Math.random() * creativePrompts.length)]);
    setCurrentPalette(colorPalettes[Math.floor(Math.random() * colorPalettes.length)]);
  }, []);

  const getNewQuote = () => {
    const newQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
    setCurrentQuote(newQuote);
  };

  const getNewPrompt = () => {
    const newPrompt = creativePrompts[Math.floor(Math.random() * creativePrompts.length)];
    setCurrentPrompt(newPrompt);
  };

  const getNewPalette = () => {
    const newPalette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
    setCurrentPalette(newPalette);
  };

  return (
    <div className="space-y-4">
      {/* Daily Quote */}
      <div className="tickd-card p-4 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Quote className="w-5 h-5 tickd-primary" />
            <h4 className="font-semibold text-sm">Daily Inspiration</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={getNewQuote}
            className="w-6 h-6 hover:tickd-primary"
            title="Show another quote"
            aria-label="Show another quote"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        <blockquote className="text-sm tickd-text mb-2 italic">
          "{currentQuote.text}"
        </blockquote>
        <cite className="text-xs tickd-light-text">— {currentQuote.author}</cite>
        
        <div className="mt-2">
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
            {currentQuote.category}
          </span>
        </div>
      </div>

      {/* Creative Prompt */}
      <div className="tickd-card p-4 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 tickd-primary" />
            <h4 className="font-semibold text-sm">Creative Prompt</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={getNewPrompt}
            className="w-6 h-6 hover:tickd-primary"
            title="Show another prompt"
            aria-label="Show another prompt"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        <p className="text-sm tickd-text mb-3">
          {currentPrompt}
        </p>
        
        <div className="text-xs tickd-light-text">
          💡 Take a moment to reflect on this
        </div>
      </div>

      {/* Color Palette Inspiration */}
      <div className="tickd-card p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 tickd-primary" />
            <h4 className="font-semibold text-sm">Color Inspiration</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={getNewPalette}
            className="w-6 h-6 hover:tickd-primary"
            title="Show another color palette"
            aria-label="Show another color palette"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mb-3">
          <h5 className="font-medium text-sm mb-2">{currentPalette.name}</h5>
          <div className="flex space-x-1 mb-2">
            {currentPalette.colors.map((color, index) => (
              <button
                type="button"
                key={index}
                className="w-8 h-8 rounded-lg shadow-sm cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={`Copy ${color}`}
                aria-label={`Copy color ${color}`}
                onClick={() => navigator.clipboard.writeText(color)}
              />
            ))}
          </div>
          <p className="text-xs tickd-light-text">{currentPalette.mood}</p>
        </div>
        
        <div className="text-xs tickd-light-text">
          🎨 Click colors to copy hex codes
        </div>
      </div>

      {/* Achievement Badge */}
      <div className="tickd-card p-3 bg-gradient-to-r from-tickd-primary/10 to-tickd-secondary/10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-tickd-primary to-tickd-secondary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium tickd-text">Creative Explorer</div>
            <div className="text-xs tickd-light-text">Keep exploring new ideas!</div>
          </div>
        </div>
      </div>

      {/* Productivity Tip */}
      <div className="text-center p-3 bg-white/40 rounded-lg">
        <div className="text-2xl mb-1">🚀</div>
        <p className="text-xs tickd-light-text">
          Studies show creativity peaks after short breaks
        </p>
      </div>
    </div>
  );
}
