'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
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
import { extractImagesFromText } from '@/lib/ai';

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
    },
    onError: (error) => {
      toast({
        type: 'error',
        description: error.message,
      });
    },
  });

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

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // 이미지 관련 디버깅 추가
  useEffect(() => {
    if (messages.length > 0) {
      // 마지막 메시지 확인 (AI 응답)
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        console.log('마지막 AI 응답 확인:');
        console.log('내용 길이:', lastMessage.content?.length || 0);
        
        // 이미지 확인
        const lastMessageAny = lastMessage as any; // 타입 이슈 해결을 위한 as any 사용
        if (lastMessageAny.images && lastMessageAny.images.length > 0) {
          console.log('응답에 이미지 포함됨:', lastMessageAny.images.length);
          console.log('첫 번째 이미지 URL:', lastMessageAny.images[0].url);
        } else {
          console.log('응답에 이미지 없음');
        }
        
        // 내용에 이미지 패턴이 있는지 확인
        if (lastMessage.content) {
          const hasImagePattern = lastMessage.content.includes('[이미지');
          console.log('응답 내용에 [이미지] 패턴 포함:', hasImagePattern);
          
          const hasSupabaseUrl = lastMessage.content.includes('ywvoksfszaelkceectaa.supabase.co');
          console.log('응답 내용에 Supabase URL 포함:', hasSupabaseUrl);
          
          // 내용에 이미지 패턴이 있지만 이미지 배열에 없는 경우, 스트리밍이 끝난 후 추가 시도
          if ((hasImagePattern || hasSupabaseUrl) && (!lastMessageAny.images || lastMessageAny.images.length === 0)) {
            console.log('경고: 응답 내용에 이미지 패턴이 있지만 이미지 배열 없음');
            
            // 상태에 따라 이미지 추출 시점 제어 (스트리밍 종료 시에만)
            if (status !== 'streaming') {
              try {
                // 메시지 완료 후 이미지 추출 시도 (스트리밍 완료 감지 시)
                console.log('스트리밍 완료 감지됨: 이미지 추출 시도...');
                
                if (lastMessage.content) {
                  const extractedImages = extractImagesFromText(lastMessage.content);
                  
                  if (extractedImages && extractedImages.length > 0) {
                    console.log('이미지 추출 성공! 이미지 발견:', extractedImages.length);
                    
                    // 메시지에 이미지 배열 추가 또는 업데이트
                    lastMessageAny.images = extractedImages;
                    
                    // 메시지 업데이트를 트리거하여 UI 갱신
                    setMessages([...messages]);
                    
                    console.log('메시지 업데이트됨, 추출된 이미지:', extractedImages.length);
                  } else {
                    console.log('이미지 추출 실패: 이미지를 찾을 수 없음');
                    
                    // 최종 백업: 지연 추출 시도 (스트리밍 완료 후 약간의 시간 후)
                    setTimeout(() => {
                      console.log('지연 이미지 추출 시도...');
                      
                      const delayedImages = extractImagesFromText(lastMessage.content || '');
                      if (delayedImages && delayedImages.length > 0) {
                        console.log('지연 추출 성공:', delayedImages.length);
                        lastMessageAny.images = delayedImages;
                        setMessages([...messages]);
                      }
                    }, 800);
                  }
                }
              } catch (error) {
                console.error('이미지 추출 시도 중 오류:', error);
              }
            } else {
              console.log('스트리밍 진행 중: 이미지 추출 대기...');
            }
          }
        }
      }
    }
  }, [messages, setMessages, status]);

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
