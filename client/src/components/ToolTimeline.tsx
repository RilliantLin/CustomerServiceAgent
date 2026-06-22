import type { AgentStep } from "@/components/agentTimeline";
import ToolCallCard from "@/components/ToolCallCard";

type ToolTimelineProps = {
  steps: AgentStep[];
  compact?: boolean;
};

export default function ToolTimeline({ steps, compact = false }: ToolTimelineProps) {
  const visibleSteps = steps.filter(step => step.stepType !== "final");
  if (visibleSteps.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {visibleSteps.map((step, index) => (
        <ToolCallCard
          key={`${step.id}-${index}`}
          step={step}
          defaultOpen={step.stepType === "error"}
        />
      ))}
    </div>
  );
}
