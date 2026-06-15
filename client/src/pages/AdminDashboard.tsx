import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = trpc.tickets.getStats.useQuery();

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-gray-500 text-lg">您没有权限访问此页面</p>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="mt-4"
              >
                返回首页
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  const statusData = [
    { name: "待处理", value: stats?.pending || 0, fill: "#FBBF24" },
    { name: "处理中", value: stats?.inProgress || 0, fill: "#3B82F6" },
    { name: "已解决", value: stats?.resolved || 0, fill: "#10B981" },
    { name: "已关闭", value: stats?.closed || 0, fill: "#D1D5DB" },
  ];

  const chartData = [
    { name: "待处理", 数量: stats?.pending || 0 },
    { name: "处理中", 数量: stats?.inProgress || 0 },
    { name: "已解决", 数量: stats?.resolved || 0 },
    { name: "已关闭", 数量: stats?.closed || 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">管理员仪表盘</h1>
          <p className="text-gray-600 mt-1">工单统计和系统概览</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">总工单数</p>
                <p className="text-4xl font-bold text-gray-900">{stats?.total || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">待处理</p>
                <p className="text-4xl font-bold text-yellow-600">{stats?.pending || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">处理中</p>
                <p className="text-4xl font-bold text-blue-600">{stats?.inProgress || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm mb-2">已解决</p>
                <p className="text-4xl font-bold text-green-600">{stats?.resolved || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 柱状图 */}
          <Card>
            <CardHeader>
              <CardTitle>工单状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="数量" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 饼图 */}
          <Card>
            <CardHeader>
              <CardTitle>工单比例</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 快速操作 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              onClick={() => setLocation("/tickets")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              查看所有工单
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/chat")}
            >
              智能客服
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
