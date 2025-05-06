import { API_BASE_URL } from '@/lib/constants';

export interface ImageData {
  url: string;
  page?: string;
  relevance_score?: number;
}

export interface ChatResponse {
  answer: string;
  context?: string;
  images?: ImageData[];
  debug_info?: any;
}

/**
 * 이미지 URL을 정규화하고 프록시 URL로 변환합니다.
 */
export function getProxyImageUrl(originalUrl: string): string {
  // 이미지 URL이 없으면 빈 문자열 반환
  if (!originalUrl) return '';
  
  // 이미 프록시된 URL인 경우 그대로 반환
  if (originalUrl.includes('/api/proxy-image')) {
    return originalUrl;
  }
  
  try {
    // 임시 로깅 추가
    console.log('정규화 전 URL:', originalUrl);
    
    // URL 앞에 @ 기호가 있는 경우 제거 (선행 @ 기호 제거)
    if (originalUrl.startsWith('@')) {
      originalUrl = originalUrl.substring(1);
      console.log('선행 @ 기호 제거 후:', originalUrl);
    }
    
    // URL 정규화: 이중 슬래시를 단일 슬래시로 변환 (프로토콜 다음 부분만)
    // 수정: protocol:// 형식의 이중 슬래시는 보존
    let normalizedUrl = originalUrl.replace(/([^:])\/\/+/g, '$1/');
    
    // URL 앞에 @ 기호가 있는 경우 제거 (중복 제거 확인)
    normalizedUrl = normalizedUrl.replace(/^@/, '');
    
    // 프로토콜 이후의 @ 기호 제거 (예: https://@example.com)
    normalizedUrl = normalizedUrl.replace(/(https?:\/\/)@/gi, '$1');
    
    // URL 끝에 괄호())가 있으면 제거
    if (normalizedUrl.endsWith(')')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
      console.log('URL 끝 괄호()) 제거 후:', normalizedUrl);
    }
    
    // URL 끝에 물음표(?)가 있으면 제거
    if (normalizedUrl.endsWith('?')) {
      normalizedUrl = normalizedUrl.slice(0, -1);
      console.log('URL 끝 물음표(?) 제거 후:', normalizedUrl);
    }
    
    // 파일 확장자 뒤에 붙은 괄호 제거 (예: .jpg)의 경우)
    normalizedUrl = normalizedUrl.replace(/(\.(jpg|jpeg|png|gif|webp))\)/gi, '$1');
    console.log('확장자 뒤 괄호 제거 후 URL:', normalizedUrl);
    
    // 프로토콜이 없는 경우 https를 기본으로 추가
    if (!normalizedUrl.match(/^https?:\/\//i)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // 이미지 경로에서 이중 슬래시 추가 검사 (특별 케이스)
    // /images//와 같은 이중 슬래시를 /images/로 수정
    normalizedUrl = normalizedUrl.replace(/\/images\/\/+/g, '/images/');
    
    // Supabase URL 특별 처리 - 도메인 경로 표준화
    if (normalizedUrl.includes('supabase.co')) {
      // storage/v1 경로 중복 제거
      normalizedUrl = normalizedUrl.replace(/(storage\/v1\/+).*?(storage\/v1\/+)/i, '$1');
      
      // object/public 경로 중복 제거
      normalizedUrl = normalizedUrl.replace(/(object\/public\/+).*?(object\/public\/+)/i, '$1');
      
      console.log('Supabase URL 경로 표준화:', normalizedUrl);
    }
    
    // URL 유효성 검사 시도
    try {
      // URL 객체 생성 시도 (잘못된 URL은 예외 발생)
      new URL(normalizedUrl);
    } catch (urlError) {
      console.error('잘못된 URL 형식:', normalizedUrl, urlError);
      // URL 복구 시도 - 기본 Supabase URL 패턴이면 가정하고 수정
      if (normalizedUrl.includes('supabase.co')) {
        const filename = normalizedUrl.split('/').pop() || '';
        normalizedUrl = `https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/${filename}`;
        console.log('URL 복구 시도:', normalizedUrl);
      }
    }
    
    // 임시 로깅 추가
    console.log('정규화 후 URL:', normalizedUrl);
    
    // URL 인코딩 처리
    const encodedUrl = encodeURIComponent(normalizedUrl);
    const proxyUrl = `/api/proxy-image?url=${encodedUrl}`;
    
    return proxyUrl;
  } catch (error) {
    console.error('URL 정규화 처리 중 오류:', error);
    // 오류 발생 시 기본 인코딩만 적용한 프록시 URL 반환
    return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  }
}

/**
 * 응답 텍스트에서 이미지 URL을 추출합니다.
 */
export function extractImagesFromText(text: string): ImageData[] {
  const images: ImageData[] = [];
  console.log('이미지 추출 시작:', text.substring(0, 200) + '...');
  
  // 백엔드 응답이 일관된 형태를 가지므로 단순화된 패턴 사용
  // [이미지 숫자] 다음 줄에 URL이 오는 패턴
  const imagePattern = /\[이미지\s*(\d+)\]\s*(?:\n|\r\n)(https?:\/\/[^\s\n]+)/gi;
  
  let match;
  while ((match = imagePattern.exec(text)) !== null) {
    const imageNum = match[1];
    const imageUrl = match[2].trim();
    
    console.log(`이미지 매칭: [${imageNum}] ${imageUrl.substring(0, 100)}...`);
    
    // 이미 추가된 URL인지 확인 (중복 방지)
    if (!images.some(img => img.url === imageUrl)) {
      images.push({ 
        url: imageUrl, 
        page: imageNum, 
        relevance_score: 0.8
      });
    }
  }
  
  // 결과 로깅
  console.log('추출된 이미지 URL 수:', images.length);
  if (images.length > 0) {
    images.forEach((img, idx) => {
      console.log(`이미지 #${idx+1}, 페이지: ${img.page}, URL: ${img.url.substring(0, 50)}...`);
    });
  }
  
  // Supabase URL 직접 추출 (URL이 없는 경우를 위한 백업)
  if (text.includes('ywvoksfszaelkceectaa.supabase.co')) {
    console.log("Supabase URL 직접 추출 시도");
    const directUrlPattern = /https?:\/\/ywvoksfszaelkceectaa\.supabase\.co\/storage\/v1\/object\/public\/images\/[^\s\n\?]+/gi;
    
    let urlMatch;
    let matchCount = 0;
    while ((urlMatch = directUrlPattern.exec(text)) !== null) {
      const imageUrl = urlMatch[0].trim();
      matchCount++;
      
      if (!images.some(img => img.url === imageUrl)) {
        images.push({ 
          url: imageUrl, 
          page: String(matchCount), 
          relevance_score: 0.5
        });
      }
    }
    
    console.log('직접 URL 추출 결과:', images.length);
  }
    
  // 파일명 패턴 기반 URL 생성 - URL 유무와 상관없이 항상 실행
  // 갤럭시 이미지 파일명 패턴을 찾기 - 더 유연한 패턴으로 수정
  const fileNamePattern = /galaxy_s25_(?:figure|chart)_p(\d+)_(?:top|mid|bot)_[a-f0-9]+\.jpg/gi;
  let fileNameMatch;
  
  while ((fileNameMatch = fileNamePattern.exec(text)) !== null) {
    const fileName = fileNameMatch[0];
    // 페이지 번호 추출 (p다음의 숫자)
    const pageMatch = fileName.match(/_p(\d+)_/i);
    const page = pageMatch ? pageMatch[1] : '1';
    
    console.log(`파일명 패턴 발견: ${fileName}, 페이지: ${page}`);
    const constructedUrl = `https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/${fileName}`;
    
    if (!images.some(img => img.url === constructedUrl)) {
      images.push({
        url: constructedUrl,
        page: page,
        relevance_score: 0.85
      });
      
      console.log('파일명 패턴 기반 URL 생성:', constructedUrl);
    }
  }
  
  return images;
}

/**
 * 채팅 메시지 전송을 위한 API 호출 함수
 */
export async function sendChatMessage(message: string, history: any[] = []) {
  try {
    console.log('API 요청 시작:', { message: message.substring(0, 50), historyLength: history.length });
    
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        debug_mode: true, // 디버깅 모드 항상 활성화
      }),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    // 응답을 텍스트로 먼저 받아서 로깅
    const responseText = await response.text();
    console.log('API 응답 원본 텍스트 (일부):', responseText.substring(0, 200));
    
    // 텍스트를 JSON으로 파싱
    let data: ChatResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('파싱 실패한 응답 텍스트:', responseText);
      throw new Error('API 응답을 JSON으로 파싱할 수 없습니다.');
    }
    
    console.log('API 응답 구문 분석 후:', {
      answer_length: data.answer?.length || 0,
      has_images: !!(data.images && data.images.length > 0),
      image_count: data.images?.length || 0,
      images_structure: data.images ? JSON.stringify(data.images).substring(0, 100) : 'null',
      has_supabase_url: data.answer?.includes('ywvoksfszaelkceectaa.supabase.co') || false,
      has_image_pattern: data.answer?.includes('[이미지') || false
    });
    
    // 응답 내용의 일부를 로깅
    if (data.answer) {
      console.log('응답 내용 일부:', `${data.answer.substring(0, 200)}...`);
      
      // 이미지 패턴이 있는지 확인
      const hasImagePattern = data.answer.includes('[이미지');
      const hasSupabaseUrl = data.answer.includes('ywvoksfszaelkceectaa.supabase.co');
      
      console.log('[이미지] 패턴 존재:', hasImagePattern);
      console.log('Supabase URL 존재:', hasSupabaseUrl);
    }
    
    // 이미지 처리: API가 이미지를 반환하지 않았거나 빈 배열인 경우 텍스트에서 추출 시도
    if (!data.images || data.images.length === 0) {
      console.log('API에서 반환된 이미지가 없습니다. 텍스트에서 추출 시도합니다.');
      console.log('받은 원본 텍스트:', data.answer);
      
      const extractedImages = extractImagesFromText(data.answer);
      if (extractedImages.length > 0) {
        console.log('텍스트에서 이미지 추출 성공:', extractedImages.length);
        console.log('추출된 이미지 URL:', extractedImages.map(img => img.url).join('\n'));
        data.images = extractedImages;
        
        // 추출된 이미지 URL을 정규 표현식으로 응답에서 제거
        extractedImages.forEach(img => {
          // 이미지 URL 패턴 전체를 제거하는 정규식 강화
          const escapedUrl = img.url.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          
          // 여러 패턴 시도 (더 포괄적인 패턴 매칭)
          const patterns = [
            // 기본 패턴 (이미지 번호 + URL)
            new RegExp(`\\[이미지\\s*\\d+\\](?:.*?\\n)?${escapedUrl}\\s*`, 'gi'),
            
            // URL만 있는 경우
            new RegExp(`${escapedUrl}\\s*`, 'gi'),
            
            // 이미지 패턴이 여러 줄에 걸쳐 있는 경우
            new RegExp(`\\[이미지\\s*\\d+\\][^\\n]*\\n(?:[^\\n]*\\n)*?${escapedUrl}\\s*(?:\\n[^\\n]*)*`, 'gi')
          ];
          
          // 각 패턴으로 시도하여 제거
          patterns.forEach(pattern => {
            data.answer = data.answer.replace(pattern, '');
        });
        });
      } else {
        console.log('텍스트에서 이미지를 추출할 수 없음');
      }
    } else {
      console.log('API에서 직접 이미지 반환됨:', data.images.length);
      console.log('이미지 목록 구조:', JSON.stringify(data.images));
    }
    
    // 이미지 URL을 프록시 URL로 변환
    if (data.images && data.images.length > 0) {
      console.log('변환 전 이미지 URL 예시:', data.images[0].url);
      
      data.images = data.images.map(img => ({
        ...img,
        url: getProxyImageUrl(img.url),
      }));
      
      console.log('변환 후 이미지 URL 예시:', data.images[0].url);
    }
    
    return data;
  } catch (error) {
    console.error('채팅 API 호출 오류:', error);
    throw error;
  }
} 