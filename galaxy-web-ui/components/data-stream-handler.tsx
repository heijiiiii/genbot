'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import { artifactDefinitions, type ArtifactKind } from './artifact';
import type { Suggestion } from '@/lib/db/schema';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import type { ImageData } from '@/lib/ai';
import { extractImagesFromText } from '@/lib/ai';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'images';
  content: string | Suggestion | ImageData[];
};

export function DataStreamHandler({ id }: { id: string }) {
  const { data: dataStream, setMessages, messages } = useChat({ id });
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);
  const imagesProcessed = useRef(false);
  const [bufferedContent, setBufferedContent] = useState('');
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 이미지 패턴 확인 함수
  const checkForImagePatterns = (content: string) => {
    if (!content) return false;
    // 이미지 패턴 확인
    const hasImagePattern = content.includes('[이미지');
    const hasImageUrl = content.includes('ywvoksfszaelkceectaa.supabase.co') || 
                         content.match(/https?:\/\/[^\s\n]+/);
    return hasImagePattern || hasImageUrl;
  };

  // 버퍼된 콘텐츠에서 이미지 처리
  const processBufferedContent = () => {
    if (!bufferedContent || imagesProcessed.current) return;
    
    console.log('버퍼된 콘텐츠에서 이미지 패턴 처리 시도...');
    
    try {
      const extractedImages = extractImagesFromText(bufferedContent);
      
      if (extractedImages && extractedImages.length > 0) {
        console.log('버퍼된 콘텐츠에서 이미지 추출 성공:', extractedImages.length);
        
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastIndex = updatedMessages.length - 1;
          
          if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
            const updatedMessage = {
              ...updatedMessages[lastIndex],
              images: extractedImages
            };
            
            updatedMessages[lastIndex] = updatedMessage;
          }
          
          return updatedMessages;
        });
        
        imagesProcessed.current = true;
      } else {
        console.log('버퍼된 콘텐츠에서 이미지 패턴 없음');
      }
    } catch (error) {
      console.error('버퍼된 콘텐츠 처리 중 오류:', error);
    }
  };

  // 스트림 데이터 처리
  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      // 텍스트 델타를 버퍼에 추가
      if (delta.type === 'text-delta' && typeof delta.content === 'string') {
        setBufferedContent(prev => prev + delta.content);
        
        // 버퍼 처리 타임아웃 설정 (이전 타임아웃 취소)
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
        }
        
        // 500ms 후에 버퍼된 콘텐츠에서 이미지 처리
        bufferTimeoutRef.current = setTimeout(() => {
          processBufferedContent();
        }, 500);
      }

      // 이미지 메타데이터 처리
      if (delta.type === 'images' && Array.isArray(delta.content)) {
        console.log('이미지 메타데이터 수신됨:', (delta.content as ImageData[]).length);
        imagesProcessed.current = true;
        
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          
          if (lastMessage && lastMessage.role === 'assistant') {
            const updatedMessage = {
              ...lastMessage,
              images: delta.content as ImageData[]
            };
            updatedMessages[updatedMessages.length - 1] = updatedMessage;
            console.log('메시지에 이미지 메타데이터 추가됨:', (delta.content as ImageData[]).length);
          }
          
          return updatedMessages;
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'id':
            return {
              ...draftArtifact,
              documentId: delta.content as string,
              status: 'streaming',
            };

          case 'title':
            return {
              ...draftArtifact,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'finish':
            // 스트리밍 완료 시 남은 버퍼 처리
            processBufferedContent();
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    });

    // 컴포넌트 언마운트 시 타임아웃 정리
    return () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
    };
  }, [dataStream, setArtifact, setMetadata, artifact, setMessages, bufferedContent]);

  // 스트리밍이 완료된 후 이미지 처리 (백업 메커니즘)
  useEffect(() => {
    // 마지막 메시지가 assistant이고 이미지가 처리되지 않은 경우에만 실행
    if (
      !imagesProcessed.current && 
      messages.length > 0 && 
      messages[messages.length - 1].role === 'assistant' &&
      messages[messages.length - 1].content
    ) {
      const lastMessage = messages[messages.length - 1];
      
      // 이미 이미지가 있는지 확인
      const hasImages = (lastMessage as any).images && (lastMessage as any).images.length > 0;
      if (hasImages) {
        imagesProcessed.current = true;
        return;
      }
      
      // 내용에 이미지 패턴이 있는지 확인
      const content = lastMessage.content;
      const hasImagePattern = content.includes('[이미지');
      const hasSupabaseUrl = content.includes('ywvoksfszaelkceectaa.supabase.co');
      
      if (hasImagePattern || hasSupabaseUrl) {
        console.log('이미지 패턴 감지됨, 백업 추출 메커니즘 실행');
        
        try {
          const extractedImages = extractImagesFromText(content);
          
          if (extractedImages && extractedImages.length > 0) {
            console.log('백업 방식으로 이미지 추출 성공:', extractedImages.length);
            
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
            
            imagesProcessed.current = true;
          }
        } catch (error) {
          console.error('이미지 백업 추출 중 오류:', error);
        }
      }
    }
  }, [messages, setMessages]);

  return null;
}
