import { AlertTriangle } from "lucide-react";

type ToolErrorPanelProps = {
  error?: string | null;
};

export default function ToolErrorPanel({ error }: ToolErrorPanelProps) {
  if (!error) return null;

  return (
    <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="whitespace-pre-wrap">{error}</p>
    </div>
  );
}
