import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function TicketCreate() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const createMutation = trpc.tickets.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("请填写所有必填项");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        title,
        description,
        priority: priority as any,
      });
      toast.success("工单创建成功");
      setLocation("/tickets");
    } catch (error) {
      toast.error("创建工单失败");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* 返回按钮 */}
        <Button
          variant="outline"
          onClick={() => setLocation("/tickets")}
          className="mb-6"
        >
          ← 返回列表
        </Button>

        {/* 创建工单表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">创建新工单</CardTitle>
            <p className="text-gray-600 text-sm mt-2">
              请详细描述您的问题，我们的客服团队将尽快为您处理
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 工单标题 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  工单标题 *
                </label>
                <Input
                  type="text"
                  placeholder="请输入工单标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-gray-300"
                  required
                />
              </div>

              {/* 工单描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  问题描述 *
                </label>
                <Textarea
                  placeholder="请详细描述您遇到的问题..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-gray-300"
                  rows={6}
                  required
                />
              </div>

              {/* 优先级 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  优先级
                </label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低 - 一般问题</SelectItem>
                    <SelectItem value="medium">中 - 标准问题</SelectItem>
                    <SelectItem value="high">高 - 重要问题</SelectItem>
                    <SelectItem value="urgent">紧急 - 影响业务</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {createMutation.isPending ? "创建中..." : "创建工单"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/tickets")}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
