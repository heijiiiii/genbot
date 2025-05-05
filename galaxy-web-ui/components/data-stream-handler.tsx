'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { artifactDefinitions, type ArtifactKind } from './artifact';
import type { Suggestion } from '@/lib/db/schema';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import type { ImageData } from '@/lib/ai';

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

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      if (delta.type === 'images' && Array.isArray(delta.content)) {
        console.log('이미지 데이터 스트림 델타 수신:', delta.content.length);
        
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            const lastMessageAny = lastMessage as any;
            
            if (!lastMessageAny.images) {
              lastMessageAny.images = delta.content as ImageData[];
              console.log('마지막 메시지에 이미지 배열 추가됨:', delta.content.length);
            } else {
              const existingUrls = new Set(lastMessageAny.images.map((img: ImageData) => img.url));
              
              const newImages = (delta.content as ImageData[]).filter(
                (img: ImageData) => !existingUrls.has(img.url)
              );
              
              if (newImages.length > 0) {
                lastMessageAny.images = [...lastMessageAny.images, ...newImages];
                console.log('기존 이미지 배열에 새 이미지 추가됨:', newImages.length);
              }
            }
            
            setMessages([...messages]);
          }
        }
      }
      
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
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact, messages, setMessages]);

  return null;
}
