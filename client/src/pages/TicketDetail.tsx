import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import PageNav from "@/components/PageNav";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface TicketDetailProps {
  params: { id: string };
}

export default function TicketDetail({ params }: TicketDetailProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const ticketId = parseInt(params.id, 10);
  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [newPriority, setNewPriority] = useState<string>("");

  const { data: ticket, isLoading: ticketLoading } = trpc.tickets.getById.useQuery({ id: ticketId });
  const { data: notes, isLoading: notesLoading } = trpc.tickets.getNotes.useQuery({ ticketId });

  const updateMutation = trpc.tickets.update.useMutation();
  const addNoteMutation = trpc.tickets.addNote.useMutation();

  const statusLabels: Record<string, string> = {
    pending: "待处理",
    in_progress: "处理中",
    resolved: "已解决",
    closed: "已关闭",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
  };

  const priorityLabels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
  };

  const priorityColors: Record<string, string> = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addNoteMutation.mutateAsync({ ticketId, content: newNote });
      setNewNote("");
      toast.success("备注已添加");
    } catch (error) {
      toast.error("添加备注失败");
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      await updateMutation.mutateAsync({ id: ticketId, status: status as any });
      setNewStatus("");
      toast.success("工单状态已更新");
    } catch (error) {
      toast.error("更新失败");
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    try {
      await updateMutation.mutateAsync({ id: ticketId, priority: priority as any });
      setNewPriority("");
      toast.success("优先级已更新");
    } catch (error) {
      toast.error("更新失败");
    }
  };

  if (ticketLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-14">
        <PageNav />
        <div className="flex justify-center items-center h-[calc(100vh-3.5rem)]">
        <Spinner />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 pt-14">
        <PageNav />
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-gray-500 text-lg">工单不存在</p>
              <Button
                variant="outline"
                onClick={() => setLocation("/tickets")}
                className="mt-4"
              >
                返回列表
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-14">
      <PageNav />
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* 工单基本信息 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">
                  #{ticket.id} - {ticket.title}
                </CardTitle>
                <p className="text-gray-600 text-sm mt-2">
                  创建于 {new Date(ticket.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge className={statusColors[ticket.status]}>
                  {statusLabels[ticket.status]}
                </Badge>
                <Badge className={priorityColors[ticket.priority]}>
                  {priorityLabels[ticket.priority]}优先级
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 工单描述 */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">工单描述</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* 状态和优先级更新 */}
            {user?.role === "admin" && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    更新状态
                  </label>
                  <div className="flex gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="选择新状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">待处理</SelectItem>
                        <SelectItem value="in_progress">处理中</SelectItem>
                        <SelectItem value="resolved">已解决</SelectItem>
                        <SelectItem value="closed">已关闭</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => handleUpdateStatus(newStatus)}
                      disabled={!newStatus || updateMutation.isPending}
                    >
                      更新
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    更新优先级
                  </label>
                  <div className="flex gap-2">
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="选择优先级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">低</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="urgent">紧急</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => handleUpdatePriority(newPriority)}
                      disabled={!newPriority || updateMutation.isPending}
                    >
                      更新
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 工单备注 */}
        <Card>
          <CardHeader>
            <CardTitle>工单历史</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 添加备注表单 */}
            <div className="border-b pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                添加备注
              </label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="输入备注内容..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 border-gray-300"
                  rows={3}
                />
              </div>
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || addNoteMutation.isPending}
                className="mt-2"
              >
                添加备注
              </Button>
            </div>

            {/* 备注列表 */}
            {notesLoading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : notes && notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note: any) => (
                  <div key={note.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900">
                        {note.noteType === "status_change" && "📋 状态变更"}
                        {note.noteType === "comment" && "💬 备注"}
                        {note.noteType === "assignment" && "👤 分配"}
                        {note.noteType === "system" && "⚙️ 系统"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(note.createdAt), {
                          locale: zhCN,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="text-gray-700">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">暂无备注</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
