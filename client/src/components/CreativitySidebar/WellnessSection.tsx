import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Pause, Play, RotateCcw, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type BreathPhase = "inhale" | "hold" | "exhale" | "rest";

interface BreathingExercise {
  id: string;
  name: string;
  description: string;
  benefit: string;
  phases: Array<{ phase: BreathPhase; seconds: number }>;
}

const breathingExercises: BreathingExercise[] = [
  {
    id: "box",
    name: "Box breathing",
    description: "A balanced reset for focus before deep work.",
    benefit: "Best before calls, writing, and invoice reviews.",
    phases: [
      { phase: "inhale", seconds: 4 },
      { phase: "hold", seconds: 4 },
      { phase: "exhale", seconds: 4 },
      { phase: "rest", seconds: 4 },
    ],
  },
  {
    id: "478",
    name: "4-7-8 calm",
    description: "A slower pattern for winding down after intense sessions.",
    benefit: "Useful when context switching feels heavy.",
    phases: [
      { phase: "inhale", seconds: 4 },
      { phase: "hold", seconds: 7 },
      { phase: "exhale", seconds: 8 },
    ],
  },
  {
    id: "steady",
    name: "Steady rhythm",
    description: "Simple inhale and exhale pacing for an unobtrusive pause.",
    benefit: "Good for short breaks between tasks.",
    phases: [
      { phase: "inhale", seconds: 5 },
      { phase: "exhale", seconds: 5 },
    ],
  },
];

const phaseLabels: Record<BreathPhase, string> = {
  inhale: "Inhale",
  hold: "Hold",
  exhale: "Exhale",
  rest: "Rest",
};

const phaseHelp: Record<BreathPhase, string> = {
  inhale: "Let the circle expand as you breathe in.",
  hold: "Keep your shoulders relaxed.",
  exhale: "Let the circle settle as you breathe out.",
  rest: "Pause gently before the next breath.",
};

/**
 * Target scale for each phase, applied through a CSS custom property so the
 * easing can run for the phase's full duration.
 *
 * The previous version returned Tailwind classes with a fixed 1s transition,
 * which meant a 7-second hold snapped in one second and then sat still. It also
 * returned `scale-80`, which is not a class Tailwind generates, so the rest
 * phase silently had no scale at all.
 */
const phaseScale: Record<BreathPhase, number> = {
  inhale: 1,
  hold: 0.97,
  exhale: 0.68,
  rest: 0.72,
};

const phaseGlow: Record<BreathPhase, number> = {
  inhale: 0.9,
  hold: 0.75,
  exhale: 0.35,
  rest: 0.25,
};

export default function WellnessSection() {
  const [selectedExerciseId, setSelectedExerciseId] = useState(breathingExercises[0].id);
  const [isActive, setIsActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(breathingExercises[0].phases[0].seconds);
  const [cycles, setCycles] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedExercise = useMemo(
    () => breathingExercises.find((exercise) => exercise.id === selectedExerciseId) || breathingExercises[0],
    [selectedExerciseId],
  );

  const currentPhase = selectedExercise.phases[phaseIndex] || selectedExercise.phases[0];
  const phaseProgress = Math.max(
    0,
    Math.min(100, ((currentPhase.seconds - secondsLeft) / currentPhase.seconds) * 100),
  );
  const totalCycleSeconds = selectedExercise.phases.reduce((total, item) => total + item.seconds, 0);

  // Drive the orb from the phase itself so the ease spans the whole phase.
  const breathStyle = {
    "--breath-scale": isActive ? phaseScale[currentPhase.phase] : phaseScale.rest,
    "--breath-duration": `${currentPhase.seconds * 1000}ms`,
    opacity: isActive ? phaseGlow[currentPhase.phase] : 0.4,
  } as React.CSSProperties;

  const resetExercise = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsActive(false);
    setPhaseIndex(0);
    setSecondsLeft(selectedExercise.phases[0].seconds);
    setCycles(0);
  };

  useEffect(() => {
    resetExercise();
  }, [selectedExerciseId]);

  useEffect(() => {
    if (!isActive) return;

    if (secondsLeft > 1) {
      timerRef.current = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    timerRef.current = setTimeout(() => {
      const nextPhaseIndex = (phaseIndex + 1) % selectedExercise.phases.length;
      if (nextPhaseIndex === 0) {
        setCycles((value) => value + 1);
      }
      setPhaseIndex(nextPhaseIndex);
      setSecondsLeft(selectedExercise.phases[nextPhaseIndex].seconds);
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, secondsLeft, phaseIndex, selectedExercise]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Wind className="h-4 w-4 text-slate-700" />
              Breathing
            </div>
            <h3 className="text-lg font-semibold text-slate-950">{selectedExercise.name}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">{selectedExercise.description}</p>
          </div>
          <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {totalCycleSeconds}s cycle
          </div>
        </div>

        <div className="mb-4 grid gap-2">
          {breathingExercises.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => setSelectedExerciseId(exercise.id)}
              className={`flex min-h-[2.75rem] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all duration-300 ${
                selectedExercise.id === exercise.id
                  ? "border-slate-950 bg-slate-950 text-white shadow-md shadow-slate-950/20"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:shadow-sm"
              }`}
              aria-pressed={selectedExercise.id === exercise.id}
            >
              <span className="min-w-0 truncate font-medium">{exercise.name}</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                  selectedExercise.id === exercise.id ? "bg-white/10 text-slate-200" : "bg-white text-slate-500"
                }`}
              >
                {exercise.phases.map((item) => item.seconds).join("-")}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
          <div className="mb-4 flex items-center justify-center">
            <div className="relative flex h-44 w-44 items-center justify-center">
              {/* Dial: 12 ticks that fill as the phase progresses. */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(226 232 240)" strokeWidth="1.5" />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="rgb(59 130 246)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(phaseProgress / 100) * 289} 289`}
                  className="transition-[stroke-dasharray] duration-1000 ease-linear"
                  opacity={isActive ? 0.9 : 0.35}
                />
              </svg>

              {/* Two slow rings so a long hold still reads as alive. */}
              {isActive && (
                <>
                  <span className="tickd-breath-ring absolute h-32 w-32 rounded-full border border-blue-400/40" />
                  <span className="tickd-breath-ring tickd-breath-ring--delayed absolute h-32 w-32 rounded-full border border-sky-300/40" />
                </>
              )}

              {/* Halo + core. Both ease across the entire phase duration. */}
              <span
                className={`absolute h-32 w-32 rounded-full bg-blue-400/20 blur-xl ${isActive ? "tickd-breath-halo" : "tickd-breath-idle"}`}
                style={breathStyle}
              />
              <span
                className={`absolute h-28 w-28 rounded-full bg-gradient-to-br from-blue-400/35 via-sky-300/25 to-indigo-400/30 shadow-[inset_0_1px_12px_rgba(255,255,255,0.7)] ring-1 ring-blue-200/70 ${isActive ? "tickd-breath-orb" : "tickd-breath-idle"}`}
                style={breathStyle}
              />

              <div className="relative text-center">
                <div className="text-4xl font-semibold tabular-nums leading-none text-slate-950">
                  {secondsLeft}
                </div>
                <div className="mt-1.5 text-sm font-medium tracking-wide text-slate-600">
                  {phaseLabels[currentPhase.phase]}
                </div>
              </div>
            </div>
          </div>

          <Progress value={phaseProgress} className="mb-3 h-1.5" />
          <div
            key={currentPhase.phase}
            className="tickd-panel-section mb-4 min-h-[2.5rem] text-center text-sm leading-5 text-slate-600"
          >
            {phaseHelp[currentPhase.phase]}
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={() => setIsActive((value) => !value)}
              className="h-10 min-w-[6.5rem] rounded-lg bg-slate-950 text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
            >
              {isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isActive ? "Pause" : "Start"}
            </Button>
            <Button onClick={resetExercise} variant="outline" className="h-10 rounded-lg">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <h4 className="text-sm font-semibold text-slate-950">Session check-in</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-semibold text-slate-950">{cycles}</div>
            <div className="text-xs text-slate-500">Completed cycles</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-semibold text-slate-950">{phaseLabels[currentPhase.phase]}</div>
            <div className="text-xs text-slate-500">Current phase</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-slate-600">{selectedExercise.benefit}</p>
      </section>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h4 className="text-sm font-semibold text-emerald-950">A small operating rhythm</h4>
        <p className="mt-1 text-sm leading-5 text-emerald-800">
          Use one full cycle before starting difficult admin work, then two cycles when switching clients.
        </p>
      </section>
    </div>
  );
}
