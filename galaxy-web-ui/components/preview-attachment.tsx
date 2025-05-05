import type { Attachment } from 'ai';
import { LoaderIcon } from './icons';
import { useEffect, useState } from 'react';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
}: {
  attachment: Attachment;
  isUploading?: boolean;
}) => {
  const { name, url, contentType } = attachment;
  const [imageSrc, setImageSrc] = useState(url);
  const [isError, setIsError] = useState(false);

  // 디버깅용 로깅
  useEffect(() => {
    console.log('첨부파일 렌더링:', { 
      타입: contentType, 
      URL: url,
      이름: name
    });
  }, [contentType, url, name]);

  const handleImageError = () => {
    console.error('이미지 로드 실패:', url);
    setIsError(true);
  };

  return (
    <div data-testid="input-attachment-preview" className="flex flex-col gap-2 w-full">
      {contentType?.startsWith('image') ? (
        <div className="w-full flex justify-center items-center">
          {isError ? (
            <div className="bg-gray-100 p-4 rounded-md text-sm text-gray-600 w-full">
              이미지를 불러올 수 없습니다
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={imageSrc}
              alt={name ?? '이미지 첨부파일'}
              className="rounded-lg max-w-full"
              style={{ maxHeight: '400px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              onError={handleImageError}
            />
          )}
        </div>
      ) : (
        <div className="bg-gray-100 p-2 rounded-md text-sm text-gray-600">
          {name || '첨부파일'}
        </div>
      )}

      {isUploading && (
        <div
          data-testid="input-attachment-loader"
          className="animate-spin absolute text-zinc-500"
        >
          <LoaderIcon />
        </div>
      )}
    </div>
  );
};
