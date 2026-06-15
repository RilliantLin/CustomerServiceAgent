import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function SmartChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    relatedKnowledge?: any[];
  }>>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const { data: chatHistory } = trpc.chat.getHistory.useQuery({});

  // 加载聊天历史
  useEffect(() => {
    if (chatHistory) {
      const formattedHistory = chatHistory.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        relatedKnowledge: msg.relatedKnowledgeIds ? JSON.parse(msg.relatedKnowledgeIds) : [],
      }));
      setMessages(formattedHistory);
    }
  }, [chatHistory]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      const result = await sendMessageMutation.mutateAsync({
        content: userMessage,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: userMessage,
        },
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.assistantMessage,
          relatedKnowledge: result.relatedKnowledge,
        },
      ]);
    } catch (error) {
      toast.error("发送消息失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto h-screen flex flex-col">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">智能客服助手</h1>
          <p className="text-gray-600 mt-1">基于 AI 和知识库的智能问答系统</p>
        </div>

        {/* 聊天容器 */}
        <Card className="flex-1 flex flex-col mb-6 overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-gray-500 text-lg mb-2">开始与 AI 客服对话</p>
                  <p className="text-gray-400 text-sm">
                    我们的 AI 助手将基于知识库为您提供帮助
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      <Streamdown>{message.content}</Streamdown>

                      {/* 显示关联的知识库 */}
                      {message.relatedKnowledge && message.relatedKnowledge.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300 text-xs">
                          <p className="font-semibold mb-2">📚 参考知识库：</p>
                          <div className="space-y-1">
                            {message.relatedKnowledge.map((kb: any, idx: number) => (
                              <div key={idx} className="text-gray-600">
                                <Badge variant="outline" className="text-xs">
                                  {kb.category}
                                </Badge>
                                <p className="mt-1">{kb.title}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-900 px-4 py-3 rounded-lg">
                      <Spinner className="w-4 h-4" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>
        </Card>

        {/* 输入框 */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            type="text"
            placeholder="输入您的问题..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="flex-1 border-gray-300"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? <Spinner className="w-4 h-4" /> : "发送"}
          </Button>
        </form>
      </div>
    </div>
  );
}
