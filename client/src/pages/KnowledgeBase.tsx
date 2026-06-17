import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function KnowledgeBase() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const query = search.trim();

  const { data: entries, isLoading: listLoading } = trpc.knowledge.list.useQuery();
  const { data: searchResults, isLoading: searchLoading } = trpc.knowledge.search.useQuery(
    { query, limit: 50 },
    { enabled: query.length > 0 }
  );

  const visibleEntries = query.length > 0 ? searchResults : entries;
  const isLoading = query.length > 0 ? searchLoading : listLoading;

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries ?? []) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-gray-500 text-lg">您没有权限访问此页面</p>
              <Button variant="outline" onClick={() => setLocation("/")} className="mt-4">
                返回首页
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">知识库</h1>
            <p className="text-gray-600 mt-1">查看客服知识条目，搜索 AI 回答可引用的内容</p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/admin/dashboard")}>
            返回仪表盘
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
              <Input
                placeholder="搜索标题、关键词或内容..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="border-gray-300"
              />
              <Button variant="outline" onClick={() => setSearch("")} disabled={!search}>
                清空搜索
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>分类概览</CardTitle>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : categoryCounts.length === 0 ? (
                <p className="text-sm text-gray-500">暂无分类</p>
              ) : (
                <div className="space-y-3">
                  {categoryCounts.map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{category}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {query ? `搜索结果：${visibleEntries?.length ?? 0} 条` : `全部条目：${visibleEntries?.length ?? 0} 条`}
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Spinner />
              </div>
            ) : !visibleEntries || visibleEntries.length === 0 ? (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <p className="text-gray-500 text-lg">暂无知识库条目</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {visibleEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                            <Badge className="bg-blue-100 text-blue-800">{entry.category}</Badge>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap leading-7">{entry.content}</p>
                          {entry.keywords && (
                            <p className="text-sm text-gray-500 mt-3">关键词：{entry.keywords}</p>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 md:text-right md:min-w-28">
                          <p>更新于</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(entry.updatedAt), {
                              locale: zhCN,
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
