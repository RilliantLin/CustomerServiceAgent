import { formatJsonSummary } from "@/components/agentTimeline";

type ToolResultViewerProps = {
  value?: string | null;
};

export default function ToolResultViewer({ value }: ToolResultViewerProps) {
  return (
    <pre className="max-h-56 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-700">
      {formatJsonSummary(value) || "暂无结果"}
    </pre>
  );
}
