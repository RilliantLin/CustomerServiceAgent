import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import PageNav from "@/components/PageNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Search } from "lucide-react";
import { useLocation } from "wouter";

export default function RagDebug() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);

  const { data, isFetching } = trpc.knowledge.debugSearch.useQuery(
    { query, limit },
    { enabled: query.trim().length > 0 }
  );

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 pt-14">
        <PageNav />
        <main className="mx-auto max-w-4xl px-6 py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg text-gray-500">您没有权限访问此页面</p>
              <Button className="mt-4" variant="outline" onClick={() => setLocation("/")}>
                返回首页
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(draft.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-14">
      <PageNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-2 px-0 text-gray-600"
              onClick={() => setLocation("/admin/knowledge")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回知识库
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">RAG 调试</h1>
            <p className="mt-1 text-gray-600">
              查看问题会召回哪些知识条目，以及当前使用向量还是关键词兜底。
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <form
              onSubmit={runSearch}
              className="grid gap-3 md:grid-cols-[1fr_120px_auto]"
            >
              <Input
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder="输入用户问题，例如：退款需要多久？"
                className="border-gray-300 bg-white"
              />
              <Input
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={event => setLimit(Number(event.target.value))}
                className="border-gray-300 bg-white"
              />
              <Button type="submit" disabled={!draft.trim() || isFetching}>
                {isFetching ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    调试召回
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {query ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline">问题：{query}</Badge>
            {data ? (
              <>
                <Badge
                  className={
                    data.mode === "vector"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }
                >
                  {data.mode === "vector" ? "向量召回" : "关键词兜底"}
                </Badge>
                {data.fallbackReason ? (
                  <Badge variant="outline">原因：{data.fallbackReason}</Badge>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {isFetching ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : data && data.results.length > 0 ? (
          <div className="space-y-4">
            {data.results.map(result => (
              <Card key={result.id}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">{result.title}</CardTitle>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{result.category}</Badge>
                        <Badge variant="secondary">
                          score {Number(result.score).toFixed(4)}
                        </Badge>
                        {result.distance != null ? (
                          <Badge variant="outline">
                            distance {Number(result.distance).toFixed(4)}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">
                          embedding {result.embeddingStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                    {result.content}
                  </p>
                  {result.keywords ? (
                    <p className="mt-3 text-sm text-gray-500">
                      关键词：{result.keywords}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : query ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              没有召回任何知识条目
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              输入问题后开始调试召回
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
