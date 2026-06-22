import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation } from "wouter";
import { getDevLoginUrl } from "@/const";

export default function Home() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [runId, setRunId] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-6xl mx-auto px-6 py-20">
          {/* 导航栏 */}
          <div className="flex justify-between items-center mb-20">
            <div className="text-2xl font-bold text-gray-900">客服工单系统</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.location.href = getDevLoginUrl("user")}
              >
                演示用户登录
              </Button>
              <Button
                onClick={() => window.location.href = getDevLoginUrl("admin")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                演示管理员登录
              </Button>
            </div>
          </div>

          {/* 主要内容 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6">
                智能客服工单管理系统
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                集成 AI 对话能力和 RAG 知识库，为您的客户提供 24/7 智能支持。
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <span className="text-gray-700">智能 AI 客服，基于知识库实时回答</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <span className="text-gray-700">完整的工单管理生命周期</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <span className="text-gray-700">管理员仪表盘和数据统计</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔍</span>
                  <span className="text-gray-700">高效的知识库搜索和检索</span>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  onClick={() => window.location.href = getDevLoginUrl("user")}
                  className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6"
                >
                  演示用户登录
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = getDevLoginUrl("admin")}
                  className="text-lg px-8 py-6"
                >
                  演示管理员登录
                </Button>
              </div>
            </div>

            {/* 功能卡片 */}
            <div className="space-y-4">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">💬</span>
                    智能客服聊天
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    与 AI 助手对话，获得基于知识库的智能回答，解决常见问题。
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🎫</span>
                    工单管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    创建、跟踪和管理工单，支持优先级设置和状态流转。
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    数据分析
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    管理员可查看工单统计、趋势分析和系统概览。
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-gray-900">客服工单系统</div>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">欢迎，{user?.name || user?.email}</span>
            <Button variant="outline" onClick={() => logout()}>
              登出
            </Button>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {user?.role === "admin" ? "管理员中心" : "用户中心"}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 智能客服 */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setLocation("/chat")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-3xl">💬</span>
                智能客服
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                与 AI 助手对话，获得基于知识库的智能回答
              </p>
            </CardContent>
          </Card>

          {/* 我的工单 */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setLocation("/tickets")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-3xl">🎫</span>
                我的工单
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                查看和管理您的工单，跟踪处理进度
              </p>
            </CardContent>
          </Card>

          {/* 创建工单 */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setLocation("/ticket/create")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-3xl">➕</span>
                创建工单
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                创建新的工单，描述您的问题
              </p>
            </CardContent>
          </Card>

          {/* 管理员仪表盘 */}
          {user?.role === "admin" && (
            <>
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setLocation("/admin/dashboard")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">📊</span>
                    管理员仪表盘
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    查看工单统计和系统概览
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setLocation("/admin/knowledge")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">🔍</span>
                    知识库
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    查看和搜索客服知识条目
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-3xl">🧭</span>
                    Agent Run 排查
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-gray-600">
                    输入 Run ID 查看执行步骤、错误原因和重试入口
                  </p>
                  <div className="flex gap-2">
                    <Input
                      inputMode="numeric"
                      placeholder="Run ID"
                      value={runId}
                      onChange={(event) => setRunId(event.target.value.replace(/\D/g, ""))}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <Button
                      disabled={!runId}
                      onClick={() => setLocation(`/runs/${runId}`)}
                    >
                      查看
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
