import { AIChatClient } from "@/components/ai-chat/ai-chat-client";

export default function AIPage() {
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">
        <AIChatClient />
      </div>
    </div>
  );
}