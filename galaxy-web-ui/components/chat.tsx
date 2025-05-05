'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import type { ImageData } from '@/lib/ai';
import { extractImagesFromText } from '@/lib/ai';

// UIMessage에 이미지 배열을 추가한 인터페이스
interface MessageWithImages extends UIMessage {
  images?: ImageData[];
}

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
  session,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel,
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // 메시지 응답이 완료된 후 이미지 추출 시도
      processLastMessageForImages();
    },
    onError: (error) => {
      toast({
        type: 'error',
        description: error.message,
      });
    },
  });

  // 마지막 메시지에서 이미지를 추출하는 함수
  const processLastMessageForImages = useCallback(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant' || !lastMessage.content) return;
    
    // 이미 이미지가 있으면 처리하지 않음
    const lastMessageWithImages = lastMessage as MessageWithImages;
    if (lastMessageWithImages.images && lastMessageWithImages.images.length > 0) {
      console.log('메시지에 이미지가 이미 있음:', lastMessageWithImages.images.length);
      return;
    }
    
    // 이미지 추출 시도
    try {
      console.log('메시지에서 이미지 추출 시도');
      const extractedImages = extractImagesFromText(lastMessage.content);
      
      if (extractedImages && extractedImages.length > 0) {
        console.log('이미지 추출 성공:', extractedImages.length);
        
        // 이미지를 메시지에 추가
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastIndex = updatedMessages.length - 1;
          
          const updatedMessage = {
            ...updatedMessages[lastIndex],
            images: extractedImages
          };
          
          updatedMessages[lastIndex] = updatedMessage;
          return updatedMessages;
        });
      }
    } catch (error) {
      console.error('이미지 추출 중 오류:', error);
    }
  }, [messages, setMessages]);

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, append, hasAppendedQuery, id]);

  // 메시지 변경 시 자동으로 이미지 처리
  useEffect(() => {
    if ((status === 'ready' || status === 'error') && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // 메시지에 이미지 확인
        const messageWithImages = lastMessage as MessageWithImages;
        
        console.log('마지막 AI 응답 확인:');
        console.log('메시지 ID:', lastMessage.id);
        console.log('내용 길이:', lastMessage.content?.length || 0);
        
        if (messageWithImages.images && messageWithImages.images.length > 0) {
          console.log('이미지가 이미 있음:', messageWithImages.images.length);
        } else if (lastMessage.content) {
          // 이미지 패턴이 있는지 확인
          const hasImagePattern = lastMessage.content.includes('[이미지');
          const hasSupabaseUrl = lastMessage.content.includes('ywvoksfszaelkceectaa.supabase.co');
          
          if (hasImagePattern || hasSupabaseUrl) {
            console.log('이미지 패턴 감지됨, 이미지 추출 시도');
            processLastMessageForImages();
          }
        }
      }
    }
  }, [messages, status, processLastMessageForImages]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
