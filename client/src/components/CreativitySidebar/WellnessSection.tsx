import { useState, useEffect, useRef } from "react";
import { Heart, Play, Pause, RotateCcw, Coffee, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const breathingExercises = [
  {
    id: "4-7-8",
    name: "4-7-8 Technique",
    description: "Inhale 4s, hold 7s, exhale 8s",
    inhale: 4,
    hold: 7,
    exhale: 8,
    color: "from-blue-400 to-blue-600",
    benefit: "Reduces anxiety"
  },
  {
    id: "box",
    name: "Box Breathing",
    description: "4s each: inhale, hold, exhale, hold",
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdEmpty: 4,
    color: "from-green-400 to-green-600",
    benefit: "Improves focus"
  },
  {
    id: "energy",
    name: "Energizing Breath",
    description: "Quick inhale 2s, slow exhale 4s",
    inhale: 2,
    hold: 0,
    exhale: 4,
    color: "from-orange-400 to-red-500",
    benefit: "Boosts energy"
  }
];

const quickMeditations = [
  { duration: 60, label: "1 min", emoji: "⚡" },
  { duration: 180, label: "3 min", emoji: "🌱" },
  { duration: 300, label: "5 min", emoji: "🧘" },
];

// Ambient sound generator using Web Audio API
class AmbientSoundGenerator {
  private audioContext: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private isPlaying = false;

  async init() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  generateOceanWaves() {
    if (!this.audioContext) return;

    // Low frequency base wave
    const baseOsc = this.audioContext.createOscillator();
    const baseGain = this.audioContext.createGain();
    
    baseOsc.type = 'sine';
    baseOsc.frequency.setValueAtTime(60, this.audioContext.currentTime);
    baseGain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    
    baseOsc.connect(baseGain);
    baseGain.connect(this.audioContext.destination);
    
    this.oscillators.push(baseOsc);
    this.gainNodes.push(baseGain);

    // Add some randomness for natural wave sounds
    const modOsc = this.audioContext.createOscillator();
    const modGain = this.audioContext.createGain();
    
    modOsc.type = 'sine';
    modOsc.frequency.setValueAtTime(0.2, this.audioContext.currentTime);
    modGain.gain.setValueAtTime(10, this.audioContext.currentTime);
    
    modOsc.connect(modGain);
    modGain.connect(baseOsc.frequency);
    
    this.oscillators.push(modOsc);
    this.gainNodes.push(modGain);

    baseOsc.start();
    modOsc.start();
  }

  generateRainfall() {
    if (!this.audioContext) return;

    // White noise for rain sound
    const bufferSize = this.audioContext.sampleRate * 2;
    const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.audioContext.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const bandpass = this.audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1000, this.audioContext.currentTime);

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);

    whiteNoise.connect(bandpass);
    bandpass.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    this.gainNodes.push(gainNode);
    whiteNoise.start();
  }

  generateForestAmbient() {
    if (!this.audioContext) return;

    // Multiple oscillators for forest sounds
    const frequencies = [200, 400, 800, 1200];
    
    frequencies.forEach((freq, index) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + Math.random() * 50, this.audioContext!.currentTime);
      gain.gain.setValueAtTime(0.02 / (index + 1), this.audioContext!.currentTime);
      
      osc.connect(gain);
      gain.connect(this.audioContext!.destination);
      
      this.oscillators.push(osc);
      this.gainNodes.push(gain);
      
      osc.start();
    });
  }

  setVolume(volume: number) {
    this.gainNodes.forEach(gain => {
      gain.gain.setValueAtTime(volume * 0.1, gain.context.currentTime);
    });
  }

  stop() {
    this.oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
    });
    this.oscillators = [];
    this.gainNodes = [];
    this.isPlaying = false;
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  setIsPlaying(playing: boolean) {
    this.isPlaying = playing;
  }
}

const ambientSounds = [
  { id: 'ocean', label: 'Ocean Waves', emoji: '🌊', generator: 'generateOceanWaves' },
  { id: 'rain', label: 'Gentle Rain', emoji: '🌧️', generator: 'generateRainfall' },
  { id: 'forest', label: 'Forest Sounds', emoji: '🌲', generator: 'generateForestAmbient' },
];

export default function WellnessSection() {
  const [selectedExercise, setSelectedExercise] = useState(breathingExercises[0]);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'holdEmpty'>('inhale');
  const [timeLeft, setTimeLeft] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [selectedMeditation, setSelectedMeditation] = useState(180);
  const [meditationTime, setMeditationTime] = useState(0);
  const [isMeditating, setIsMeditating] = useState(false);
  
  // Ambient sound controls
  const [selectedSound, setSelectedSound] = useState(ambientSounds[0]);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [soundVolume, setSoundVolume] = useState([30]);
  const soundGeneratorRef = useRef<AmbientSoundGenerator>(new AmbientSoundGenerator());
  
  const intervalRef = useRef<NodeJS.Timeout>();

  const startBreathingExercise = () => {
    setIsActive(true);
    setCycle(0);
    setPhase('inhale');
    setTimeLeft(selectedExercise.inhale);
  };

  const stopBreathingExercise = () => {
    setIsActive(false);
    setPhase('inhale');
    setTimeLeft(0);
    setCycle(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const startMeditation = () => {
    setIsMeditating(true);
    setMeditationTime(selectedMeditation);
  };

  const stopMeditation = () => {
    setIsMeditating(false);
    setMeditationTime(0);
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      // Move to next phase
      if (phase === 'inhale') {
        if (selectedExercise.hold > 0) {
          setPhase('hold');
          setTimeLeft(selectedExercise.hold);
        } else {
          setPhase('exhale');
          setTimeLeft(selectedExercise.exhale);
        }
      } else if (phase === 'hold') {
        setPhase('exhale');
        setTimeLeft(selectedExercise.exhale);
      } else if (phase === 'exhale') {
        if (selectedExercise.holdEmpty) {
          setPhase('holdEmpty');
          setTimeLeft(selectedExercise.holdEmpty);
        } else {
          // Complete cycle
          setCycle(cycle + 1);
          setPhase('inhale');
          setTimeLeft(selectedExercise.inhale);
        }
      } else if (phase === 'holdEmpty') {
        // Complete cycle
        setCycle(cycle + 1);
        setPhase('inhale');
        setTimeLeft(selectedExercise.inhale);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isActive, timeLeft, phase, selectedExercise, cycle]);

  useEffect(() => {
    if (isMeditating && meditationTime > 0) {
      intervalRef.current = setTimeout(() => {
        setMeditationTime(meditationTime - 1);
      }, 1000);
    } else if (isMeditating && meditationTime === 0) {
      setIsMeditating(false);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isMeditating, meditationTime]);

  const getPhaseText = () => {
    switch (phase) {
      case 'inhale': return 'Breathe In';
      case 'hold': return 'Hold';
      case 'exhale': return 'Breathe Out';
      case 'holdEmpty': return 'Hold Empty';
      default: return 'Breathe';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'inhale': return 'from-blue-400 to-blue-600';
      case 'hold': return 'from-purple-400 to-purple-600';
      case 'exhale': return 'from-green-400 to-green-600';
      case 'holdEmpty': return 'from-gray-400 to-gray-600';
      default: return 'from-blue-400 to-blue-600';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Breathing Exercise */}
      <div className="tickd-card p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="flex items-center space-x-2 mb-3">
          <Heart className="w-5 h-5 tickd-primary" />
          <h4 className="font-semibold text-sm">Breathing Exercise</h4>
        </div>

        <Select
          value={selectedExercise.id}
          onValueChange={(value) => {
            const exercise = breathingExercises.find(e => e.id === value);
            if (exercise) {
              setSelectedExercise(exercise);
              stopBreathingExercise();
            }
          }}
        >
          <SelectTrigger className="mb-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {breathingExercises.map((exercise) => (
              <SelectItem key={exercise.id} value={exercise.id}>
                {exercise.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-center mb-4">
          <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br ${
            isActive ? getPhaseColor() : selectedExercise.color
          } flex items-center justify-center mb-3 transition-all duration-1000 ${
            isActive ? 'animate-pulse' : ''
          }`}>
            <div className="text-white text-center">
              <div className="text-lg font-bold">{timeLeft || selectedExercise.inhale}</div>
              <div className="text-xs">{isActive ? getPhaseText() : 'Ready'}</div>
            </div>
          </div>

          {isActive && (
            <div className="text-sm tickd-light-text mb-2">
              Cycle {cycle + 1} • {getPhaseText()}
            </div>
          )}

          <p className="text-xs tickd-light-text mb-3">
            {selectedExercise.description}
          </p>
          <p className="text-xs text-green-600 font-medium">
            {selectedExercise.benefit}
          </p>
        </div>

        <div className="flex justify-center space-x-2">
          <Button
            onClick={isActive ? stopBreathingExercise : startBreathingExercise}
            className={`${isActive ? 'bg-red-500 hover:bg-red-600' : 'tickd-bg-primary'} text-white`}
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          {isActive && (
            <Button
              variant="ghost"
              onClick={stopBreathingExercise}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick Meditation */}
      <div className="tickd-card p-4 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex items-center space-x-2 mb-3">
          <Moon className="w-5 h-5 tickd-primary" />
          <h4 className="font-semibold text-sm">Quick Meditation</h4>
        </div>

        <div className="flex justify-center space-x-2 mb-4">
          {quickMeditations.map((med) => (
            <button
              key={med.duration}
              onClick={() => setSelectedMeditation(med.duration)}
              className={`px-3 py-2 rounded-lg text-sm transition-all ${
                selectedMeditation === med.duration
                  ? 'tickd-bg-primary text-white'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80'
              }`}
            >
              <div>{med.emoji}</div>
              <div className="text-xs">{med.label}</div>
            </button>
          ))}
        </div>

        {isMeditating ? (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center mb-3 animate-pulse">
              <div className="text-white font-bold">{formatTime(meditationTime)}</div>
            </div>
            <p className="text-sm tickd-light-text mb-3">Find your center...</p>
            <Button
              onClick={stopMeditation}
              variant="ghost"
              className="text-red-500"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <Button
              onClick={startMeditation}
              className="tickd-bg-primary text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Start {formatTime(selectedMeditation)}
            </Button>
          </div>
        )}
      </div>

      {/* Daily Wellness Tip */}
      <div className="tickd-card p-3 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center space-x-2 mb-2">
          <Sun className="w-4 h-4 text-green-600" />
          <h5 className="font-medium text-sm text-green-800">Wellness Tip</h5>
        </div>
        <p className="text-xs text-green-700">
          Take a 2-minute breathing break every hour to maintain focus and reduce stress.
        </p>
      </div>

      {/* Break Reminder */}
      <div className="text-center p-3 bg-white/40 rounded-lg">
        <div className="flex items-center justify-center space-x-2 mb-1">
          <Coffee className="w-4 h-4 tickd-primary" />
          <span className="text-sm font-medium tickd-text">Time for a break?</span>
        </div>
        <p className="text-xs tickd-light-text">
          Regular breaks boost creativity by 23%
        </p>
      </div>
    </div>
  );
}