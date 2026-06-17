import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import PageNav from "@/components/PageNav";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function SmartChat() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    relatedKnowledge?: any[];
    isStreaming?: boolean;
  }>>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const { data: chatHistory } = trpc.chat.getHistory.useQuery({});

  const streamAssistantMessage = (
    id: string,
    content: string,
    relatedKnowledge: any[] = []
  ) => {
    const characters = Array.from(content || "抱歉，我无法处理您的请求。");
    let index = 0;

    const tick = () => {
      index += 1;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id
            ? {
                ...message,
                content: characters.slice(0, index).join(""),
                relatedKnowledge: index >= characters.length ? relatedKnowledge : [],
                isStreaming: index < characters.length,
              }
            : message
        )
      );

      if (index < characters.length) {
        window.setTimeout(tick, 18);
      } else {
        setIsLoading(false);
      }
    };

    tick();
  };

  // 加载聊天历史
  useEffect(() => {
    if (chatHistory) {
      const formattedHistory = chatHistory.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        relatedKnowledge: msg.relatedKnowledge ?? [],
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
    const now = Date.now();
    const assistantId = `${now + 1}`;
    setInputValue("");
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `${now}`,
        role: "user",
        content: userMessage,
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        relatedKnowledge: [],
        isStreaming: true,
      },
    ]);

    try {
      const result = await sendMessageMutation.mutateAsync({
        content: userMessage,
      });

      streamAssistantMessage(
        assistantId,
        result.assistantMessage,
        result.relatedKnowledge
      );
    } catch (error: any) {
      setMessages((prev) => prev.filter((message) => message.id !== assistantId));
      toast.error(error?.message || "发送消息失败，请稍后重试");
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 pt-14">
      <PageNav />
      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-4 py-4 sm:px-6">
        {/* 页面标题 */}
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">智能客服助手</h1>
          <p className="text-gray-600 mt-1">基于 AI 和知识库的智能问答系统</p>
        </div>

        {/* 聊天容器 */}
        <Card className="mb-4 flex min-h-0 flex-1 flex-col overflow-hidden">
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
                      {message.content ? (
                        <Streamdown>{message.content}</Streamdown>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Spinner className="h-4 w-4" />
                          <span className="text-sm">正在思考...</span>
                        </div>
                      )}

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
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>
        </Card>

        {/* 输入框 */}
        <form onSubmit={handleSendMessage} className="flex shrink-0 gap-2 pb-2">
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
