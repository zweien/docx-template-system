import { AIChatShell } from "@/components/ai-chat/ai-chat-shell";

interface AIPageProps {
  searchParams?: Promise<{ tableId?: string }>;
}

export default async function AIPage({ searchParams }: AIPageProps) {
  const params = searchParams ? await searchParams : undefined;

  return (
    <div className="h-full min-h-0 w-full">
      <AIChatShell initialTableId={params?.tableId} />
    </div>
  );
}
