import { Home } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

type PageNavProps = {
  title?: string;
};

export default function PageNav({ title = "客服工单系统" }: PageNavProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="truncate text-left text-lg font-semibold text-gray-900"
          >
            {title}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {user?.name || user?.email ? (
            <span className="hidden max-w-48 truncate text-sm text-gray-600 sm:block">
              {user.name || user.email}
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </div>
      </div>
    </header>
  );
}
