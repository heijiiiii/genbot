'use client';

import { useState, useEffect } from 'react';

export default function ImageTestPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState(false);
  const [proxySuccess, setProxySuccess] = useState(false);
  
  // 실제 이미지 URL 및 프록시 URL
  const originalUrl = "https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/galaxy_s25_chart_p44_bot_c831a541.jpg";
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  
  // 이미지 로딩 테스트
  const testImage = (url: string, setSuccess: (success: boolean) => void) => {
    // HTMLImageElement 타입으로 명시적 캐스팅
    const img = new window.Image();
    
    img.onload = () => {
      console.log(`이미지 로드 성공: ${url}`);
      setSuccess(true);
      setLoading(false);
    };
    
    img.onerror = () => {
      console.error(`이미지 로드 실패: ${url}`);
      setSuccess(false);
      setLoading(false);
      setError(`이미지 로드 실패: ${url}`);
    };
    
    img.src = url;
  };
  
  useEffect(() => {
    // 직접 URL 테스트
    testImage(originalUrl, setDirectSuccess);
    
    // 프록시 URL 테스트
    testImage(proxyUrl, setProxySuccess);
  }, []);
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">이미지 로딩 테스트</h1>
      
      {loading ? (
        <p>이미지 로딩 중...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">직접 URL 테스트</h2>
              <p>상태: {directSuccess ? '성공 ✅' : '실패 ❌'}</p>
              <p className="text-xs text-gray-500 mb-4 break-all">{originalUrl}</p>
              
              {directSuccess ? (
                <div className="relative w-full h-[400px]">
                  <img 
                    src={originalUrl}
                    alt="직접 URL 테스트"
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
              ) : (
                <div className="bg-red-100 p-4 rounded">
                  <p>이미지를 로드할 수 없습니다</p>
                </div>
              )}
            </div>
            
            <div className="border p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">프록시 URL 테스트</h2>
              <p>상태: {proxySuccess ? '성공 ✅' : '실패 ❌'}</p>
              <p className="text-xs text-gray-500 mb-4 break-all">{proxyUrl}</p>
              
              {proxySuccess ? (
                <div className="relative w-full h-[400px]">
                  <img 
                    src={proxyUrl}
                    alt="프록시 URL 테스트"
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
              ) : (
                <div className="bg-red-100 p-4 rounded">
                  <p>이미지를 로드할 수 없습니다</p>
                </div>
              )}
            </div>
          </div>
          
          {error && (
            <div className="mt-6 p-4 bg-red-100 rounded">
              <h3 className="font-semibold">오류 정보:</h3>
              <p>{error}</p>
            </div>
          )}
          
          <div className="mt-8 p-4 bg-gray-100 rounded">
            <h3 className="font-semibold mb-2">디버깅 팁:</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>개발자 도구 네트워크 탭에서 이미지 요청을 확인하세요.</li>
              <li>CORS 오류가 있는지 확인하세요.</li>
              <li>프록시 엔드포인트의 응답 상태를 확인하세요.</li>
              <li>이미지 URL에 특수 문자가 있는지 확인하세요.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
} 