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

const getCircleScale = (phase: BreathPhase) => {
  if (phase === "inhale") return "scale-100";
  if (phase === "hold") return "scale-95";
  if (phase === "exhale") return "scale-75";
  return "scale-80";
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
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                selectedExercise.id === exercise.id
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
              }`}
            >
              <div className="font-medium">{exercise.name}</div>
              <div className={selectedExercise.id === exercise.id ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                {exercise.phases.map((item) => item.seconds).join("-")}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-slate-200 bg-white" />
              <div
                className={`absolute h-28 w-28 rounded-full bg-blue-500/15 transition-transform duration-1000 ease-in-out ${getCircleScale(currentPhase.phase)}`}
              />
              <div className="relative text-center">
                <div className="text-3xl font-semibold tabular-nums text-slate-950">{secondsLeft}</div>
                <div className="text-sm font-medium text-slate-600">{phaseLabels[currentPhase.phase]}</div>
              </div>
            </div>
          </div>

          <Progress value={phaseProgress} className="mb-3 h-2" />
          <div className="mb-4 text-center text-sm text-slate-600">{phaseHelp[currentPhase.phase]}</div>

          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={() => setIsActive((value) => !value)}
              className="h-10 rounded-md bg-slate-950 text-white hover:bg-slate-800"
            >
              {isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isActive ? "Pause" : "Start"}
            </Button>
            <Button onClick={resetExercise} variant="outline" className="h-10 rounded-md">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
