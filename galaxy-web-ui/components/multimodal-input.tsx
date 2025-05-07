'use client';

import type { Attachment, UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { cn } from '@/lib/utils';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  return (
    <div className="relative w-full flex flex-col gap-4">
      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}
          {uploadQueue.map((file, index) => (
            <div
              key={`${file}-${index}`}
              className="flex flex-col gap-1 items-center p-4 border rounded-xl border-dashed max-w-36 min-w-20 animate-pulse-slow"
            >
              <div className="bg-gray-200 rounded-md h-4 w-12 mb-1"></div>
              <div className="text-xs text-muted-foreground truncate max-w-full">
                {file.length > 15 ? `${file.slice(0, 15)}...` : file}
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitForm();
        }}
        className="relative"
      >
        <div className="flex items-center relative">
          <Textarea
            ref={textareaRef}
            data-testid="multimodal-input"
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submitForm();
              }
            }}
            placeholder="메시지 입력..."
            value={input}
            onChange={handleInput}
            className="min-h-[58px] rounded-2xl pr-12 border-galaxy-light/70 focus:border-galaxy-blue focus:ring-1 focus:ring-galaxy-blue/50 shadow-galaxy transition-all duration-200 resize-none bg-white placeholder:text-gray-400"
            disabled={
              status === 'streaming' ||
              status === 'submitted' ||
              uploadQueue.length > 0
            }
          />
        </div>

        <div className="absolute flex gap-1.5 items-center right-2 bottom-2.5">
          <PureAttachmentsButton
            fileInputRef={fileInputRef}
            status={status}
          />
          {status === 'streaming' ? (
            <PureStopButton stop={stop} setMessages={setMessages} />
          ) : (
            <PureSendButton
              submitForm={submitForm}
              input={input}
              uploadQueue={uploadQueue}
            />
          )}
        </div>
      </form>

      {input === '' &&
        status !== 'streaming' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'assistant' && (
          <SuggestedActions chatId={chatId} append={append} />
        )}
    </div>
  );
}

export const MultimodalInput = memo(PureMultimodalInput, (prev, next) => {
  return (
    prev.input === next.input &&
    prev.status === next.status &&
    equal(prev.attachments, next.attachments) &&
    prev.messages.length === next.messages.length &&
    (prev.messages.length === 0 ||
      prev.messages[prev.messages.length - 1].id ===
        next.messages[next.messages.length - 1].id)
  );
});

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers['status'];
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="size-8 text-muted-foreground hover:text-foreground hover:bg-galaxy-light/50 transition-all duration-200 rounded-full"
      onClick={() => fileInputRef.current?.click()}
      disabled={status === 'streaming' || status === 'submitted'}
      data-testid="attachments-button"
    >
      <PaperclipIcon />
      <span className="sr-only">Add attachment</span>
    </Button>
  );
}

const AttachmentsButton = memo(
  PureAttachmentsButton,
  (prev, next) => prev.status === next.status,
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers['setMessages'];
}) {
  return (
    <Button
      type="button"
      size="icon"
      className="size-8 bg-galaxy-red/85 hover:bg-galaxy-red text-white rounded-full shadow-sm hover:shadow-md transition-all duration-200"
      onClick={() => {
        stop();
        setMessages((messages) => {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role === 'assistant') {
            return messages.slice(0, -1);
          }
          return messages;
        });
      }}
      data-testid="stop-button"
    >
      <StopIcon />
      <span className="sr-only">Stop generating</span>
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  const isEmpty = input.trim().length === 0;
  const isUploading = uploadQueue.length > 0;

  return (
    <Button
      type="submit"
      size="icon"
      data-testid="send-button"
      className={cn(
        'size-8 transition-all duration-300 rounded-full shadow-sm hover:shadow-md',
        isEmpty || isUploading
          ? 'bg-galaxy-blue/40 text-white cursor-not-allowed'
          : 'bg-gradient-to-r from-galaxy-blue to-galaxy-navy text-white hover:from-galaxy-blue-light hover:to-galaxy-blue transform hover:scale-105'
      )}
      disabled={isEmpty || isUploading}
    >
      <ArrowUpIcon />
      <span className="sr-only">Send message</span>
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
