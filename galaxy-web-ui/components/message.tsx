'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState, useEffect } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import { ChatImageGallery } from './chat-image';
import type { ImageData } from '@/lib/ai';

// 메시지 속성에 이미지 배열 추가
interface MessageWithImages extends UIMessage {
  images?: ImageData[];
}

// 디버깅 상수
const DEBUG_MESSAGE_IMAGES = true;

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
}: {
  chatId: string;
  message: MessageWithImages;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // 이미지 확인 로직 추가
  useEffect(() => {
    if (message?.role === 'assistant' && DEBUG_MESSAGE_IMAGES) {
      console.log('메시지 디버깅 - ID:', message.id);
      console.log('메시지 역할:', message.role);
      console.log('내용 길이:', message.content?.length || 0);
      
      // 내용에 이미지 패턴 및 URL 확인
      const hasImagePattern = message.content?.includes('[이미지') || false;
      const hasSupabaseUrl = message.content?.includes('ywvoksfszaelkceectaa.supabase.co') || false;
      const hasAnyUrl = message.content?.match(/https?:\/\/[^\s\n]+/i) !== null;
      console.log('내용에 [이미지] 패턴 포함 여부:', hasImagePattern);
      console.log('내용에 Supabase URL 포함 여부:', hasSupabaseUrl);
      console.log('내용에 URL 포함 여부:', hasAnyUrl);
      
      // 메시지에 이미지 배열 확인
      const messageAny = message as any;
      if (messageAny.images && messageAny.images.length > 0) {
        console.log('메시지에 이미지 배열 있음:', messageAny.images.length);
        messageAny.images.forEach((img: any, idx: number) => {
          console.log(`이미지 #${idx+1} URL:`, img.url);
        });
      } else {
        console.log('메시지에 이미지 배열 없음');
      }
      
      // 내용에서 이미지 패턴이 있는데 이미지 배열이 없는 경우, 직접 추출 시도
      if (hasImagePattern || hasSupabaseUrl || hasAnyUrl) {
        if (!messageAny.images || messageAny.images.length === 0) {
          console.log('내용에 이미지 패턴이 있지만 이미지 배열 없음, 직접 추출 시도');
          
          try {
            // 처리할 텍스트 전체 길이 로깅
            console.log('처리할 텍스트 전체 길이:', message.content?.length || 0);
            
            // 내용이 있을 경우만 처리
            if (message.content) {
              // 이미지 패턴이 있는지 간단히 체크
              const imagePatternCheck = message.content.match(/\[이미지\s*\d+\]/g);
              if (imagePatternCheck) {
                console.log('발견된 이미지 패턴:', imagePatternCheck);
              }
              
              // 내용에 URL이 있는지 체크
              const urlCheck = message.content.match(/https?:\/\/[^\s\n]+/gi);
              if (urlCheck) {
                console.log('발견된 URL 패턴 수:', urlCheck.length);
                if (urlCheck.length > 0) {
                  console.log('첫 번째 URL:', urlCheck[0]);
                }
              }
              
              // 이미지 추출 시도
              const extractedImages = extractImagesFromText(message.content);
              if (extractedImages && extractedImages.length > 0) {
                console.log('직접 추출된 이미지:', extractedImages.length);
                
                // 직접 추출된 이미지를 메시지에 추가
                if (!messageAny.images) {
                  messageAny.images = [];
                }
                
                extractedImages.forEach(img => {
                  if (!messageAny.images.some((existing: any) => existing.url === img.url)) {
                    messageAny.images.push(img);
                  }
                });
                
                console.log('수동으로 이미지를 메시지에 추가함:', messageAny.images.length);
              }
            }
          } catch (error) {
            console.error('이미지 직접 추출 오류:', error);
          }
        }
      }
      
      // 마지막 AI 응답 확인
      if (message.role === 'assistant' && message === message) {
        console.log('마지막 AI 응답 확인:');
        console.log('내용 길이:', message.content?.length || 0);
        console.log('응답에 이미지 없음');
        console.log('응답 내용에 [이미지] 패턴 포함:', hasImagePattern);
        console.log('응답 내용에 Supabase URL 포함:', hasSupabaseUrl);
        console.log('처리 전 텍스트 (일부):', message.content?.substring(0, 200) + '...');
      }
    }
  }, [message]);

  // 이미지 수동 추출 함수 (필요시)
  const extractImagesFromText = (text: string): ImageData[] => {
    if (!text) return [];
    
    const images: ImageData[] = [];
    
    // 원본 텍스트 처리 전 로깅
    if (DEBUG_MESSAGE_IMAGES) {
      console.log('처리할 텍스트 전체 길이:', text.length);
      console.log('처리 전 텍스트 (일부):', text.substring(0, 200) + '...');
    }
    
    // 간소화된 이미지 추출 패턴
    const patterns = [
      // 1. 기본 패턴: [이미지 숫자] 다음 줄에 URL
      /\[이미지\s*(\d+)\][^\n]*\n(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim,
      
      // 2. @ 문자가 붙은 URL 패턴
      /\[이미지\s*(\d+)\][^\n]*\n@(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim,
      
      // 3. 이미지 패턴과 URL이 같은 줄에 있는 경우
      /\[이미지\s*(\d+)\][^\n]*\s+(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim,
      
      // 4. 단순 Supabase URL 추출 (백업)
      /https?:\/\/ywvoksfszaelkceectaa\.supabase\.co\/storage\/v1\/object\/public\/images\/[^\s\n?]+(?:\?[^\s\n]*)?/gi,
      
      // 5. 스트리밍으로 인해 분리된 이미지 태그와 URL 처리
      /\[이미지\s*(\d+)\](?:(?!\[이미지)[\s\S]){1,50}(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim
    ];
    
    // 각 패턴 시도
    let totalMatches = 0;
    
    // 패턴별 처리를 위한 함수
    const processPattern = (pattern: RegExp, patternIndex: number) => {
      try {
        // 단순 URL 패턴 (패턴 4)
        if (patternIndex === 3) {
          const matches = text.match(pattern);
          if (matches) {
            matches.forEach((url, index) => {
              totalMatches++;
              const finalUrl = url.endsWith('?') ? url.slice(0, -1) : url;
              
              if (!images.some(img => img.url === finalUrl)) {
                images.push({
                  url: finalUrl,
                  page: String(index + 1),
                  relevance_score: 0.5
                });
              }
            });
          }
          return;
        }
        
        // 일반 이미지 패턴 (패턴 1-3, 5)
        let match;
        while ((match = pattern.exec(text)) !== null) {
          totalMatches++;
          const imageNum = match[1];
          let imageUrl = match[2]?.trim();
          
          if (!imageUrl) continue;
          
          // URL이 ?로 끝나면 제거
          if (imageUrl.endsWith('?')) {
            imageUrl = imageUrl.slice(0, -1);
          }
          
          // URL이 @로 시작하면 제거
          if (imageUrl.startsWith('@')) {
            imageUrl = imageUrl.substring(1);
          }
          
          // 이미 추가된 URL인지 확인 (중복 방지)
          if (!images.some(img => img.url === imageUrl)) {
            images.push({
              url: imageUrl,
              page: imageNum,
              relevance_score: 0.8
            });
          }
        }
      } catch (error) {
        console.error(`패턴 ${patternIndex + 1} 처리 중 오류:`, error);
      }
    };
    
    // 모든 패턴 처리
    patterns.forEach((pattern, index) => {
      processPattern(pattern, index);
    });
    
    if (DEBUG_MESSAGE_IMAGES) {
      console.log('발견된 이미지 패턴 수:', totalMatches);
      console.log('추출된 이미지 수:', images.length);
      
      if (images.length > 0) {
        console.log('추출된 이미지 목록:');
        images.forEach((img, idx) => {
          console.log(`이미지 ${idx + 1}: ${img.url} (page: ${img.page})`);
        });
      }
    }
    
    return images;
  };

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-col gap-4 w-full"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4 w-full', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                            message.role === 'user',
                        })}
                      >
                        <Markdown>{part.text}</Markdown>
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : null}
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              }

              return null;
            })}
            
            {/* 메시지에 이미지가 있으면 이미지 갤러리 표시 */}
            {message.role === 'assistant' && (
              <>
                {/* 이미지 배열이 있는 경우 */}
                {message.images && message.images.length > 0 && (
                  <>
                    {DEBUG_MESSAGE_IMAGES && (
                      <div className="bg-blue-50 p-2 rounded-md mb-2 text-xs">
                        이미지 {message.images.length}개 발견됨
                      </div>
                    )}
                    <ChatImageGallery images={message.images} />
                  </>
                )}
                
                {/* 이미지 배열은 없지만 내용에 이미지 패턴이 있는 경우 */}
                {(!message.images || message.images.length === 0) && 
                 message.content && 
                 message.content.includes('[이미지') && (
                  <div className="bg-yellow-50 p-2 rounded-md mb-2 text-xs">
                    <p>이미지 패턴이 감지되었지만 이미지를 표시할 수 없습니다.</p>
                    <p>패턴: {message.content.match(/\[이미지\s*\d+\]/g)?.join(', ')}</p>
                    <button 
                      onClick={() => {
                        // 메시지 내용에서 이미지 수동 추출 시도
                        try {
                          const messageAny = message as any;
                          const extractedImages = extractImagesFromText(message.content || '');
                          if (extractedImages && extractedImages.length > 0) {
                            if (!messageAny.images) {
                              messageAny.images = [];
                            }
                            
                            let newImagesAdded = false;
                            extractedImages.forEach(img => {
                              if (!messageAny.images.some((existing: any) => existing.url === img.url)) {
                                messageAny.images.push(img);
                                newImagesAdded = true;
                              }
                            });
                            
                            if (newImagesAdded) {
                              // 강제 리렌더링 (상태 업데이트)
                              const updatedMessage = { ...message };
                              setMessages(prevMessages => 
                                prevMessages.map(msg => 
                                  msg.id === message.id ? updatedMessage : msg
                                )
                              );
                            }
                          }
                        } catch (error) {
                          console.error('수동 이미지 추출 시도 중 오류:', error);
                        }
                      }}
                      className="mt-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                    >
                      이미지 추출 재시도
                    </button>
                  </div>
                )}
              </>
            )}
            
            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default memo(PurePreviewMessage);

// 이름 있는 export로 수정하여 외부에서 사용할 수 있게 함
export const PreviewMessage = memo(PurePreviewMessage, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    equal(prev.message.content, next.message.content) &&
    equal(prev.message.parts, next.message.parts) &&
    equal(prev.vote, next.vote) &&
    prev.isLoading === next.isLoading &&
    equal(prev.message.images, next.message.images)
  );
});

export const ThinkingMessage = () => {
  return (
    <div className="w-full mx-auto max-w-3xl px-4">
      <div className="flex gap-4">
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
          <div className="translate-y-px">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-1 items-center">
            <div className="size-2 bg-muted-foreground animate-bounce rounded-full" />
            <div className="size-2 bg-muted-foreground animate-bounce rounded-full [animation-delay:0.2s]" />
            <div className="size-2 bg-muted-foreground animate-bounce rounded-full [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
    </div>
  );
};