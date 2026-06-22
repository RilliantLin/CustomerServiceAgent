import { formatJsonSummary } from "@/components/agentTimeline";

type ToolArgsViewerProps = {
  value?: string | null;
};

export default function ToolArgsViewer({ value }: ToolArgsViewerProps) {
  return (
    <pre className="max-h-56 overflow-auto rounded-md border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-700">
      {formatJsonSummary(value) || "无参数"}
    </pre>
  );
}
