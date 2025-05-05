import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { Greeting } from './greeting';
import { memo, Children, type ReactNode, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  children?: ReactNode;
  className?: string;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  children,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  // 메시지들 확인을 위한 디버깅 코드 추가
  useEffect(() => {
    // children이 배열인 경우만 처리
    const childrenArray = Children.toArray(children);
    if (childrenArray.length > 0) {
      console.log('메시지 수:', childrenArray.length);
      
      // 마지막 메시지 내용 확인 (AI 응답)
      const lastMessage = childrenArray[childrenArray.length - 1];
      if (lastMessage && typeof lastMessage === 'object' && 'props' in lastMessage) {
        const messageContent = lastMessage.props?.message?.content;
        
        if (messageContent) {
          // 이미지 패턴 확인
          const textLength = messageContent.length;
          console.log('텍스트 길이:', textLength);
          
          const hasImagePattern = messageContent.includes('[이미지');
          console.log('[이미지] 패턴 존재:', hasImagePattern);
          
          const hasSupabaseUrl = messageContent.includes('ywvoksfszaelkceectaa.supabase.co');
          console.log('Supabase URL 존재:', hasSupabaseUrl);
          
          // 전체 내용 디버깅 (첫 200자)
          if (textLength > 0) {
            console.log('전체 텍스트 길이:', textLength);
            console.log('텍스트 내용 일부:', `${messageContent.substring(0, 200)}...`);
          }
        }
      }
    }
  }, [children]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
    >
      {messages.length === 0 && <Greeting />}

      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' && messages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
        />
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
});
