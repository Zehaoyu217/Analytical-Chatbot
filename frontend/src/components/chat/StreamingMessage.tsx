import type { Message } from "@/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  message: Message;
}

export function StreamingMessage({ message }: Props) {
  return <MessageBubble message={message} />;
}
