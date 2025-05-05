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
  // 이미 프록시된 URL인 경우 그대로 반환
  if (originalUrl.includes('/api/proxy-image')) {
    return originalUrl;
  }
  
  // URL 정규화: 이중 슬래시를 단일 슬래시로 변환 (프로토콜 다음 부분만)
  let normalizedUrl = originalUrl.replace(/([^:])\/\/+/g, '$1/');
  
  // URL 앞에 @ 기호가 있는 경우 제거
  normalizedUrl = normalizedUrl.replace(/(https?:\/\/)@/gi, '$1');
  
  // 프로토콜이 없는 경우 https를 기본으로 추가
  if (!normalizedUrl.match(/^https?:\/\//i)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  // URL 인코딩 처리
  const encodedUrl = encodeURIComponent(normalizedUrl);
  return `/api/proxy-image?url=${encodedUrl}`;
}

/**
 * 응답 텍스트에서 이미지 URL을 추출합니다.
 */
export function extractImagesFromText(text: string): ImageData[] {
  const images: ImageData[] = [];
  console.log('이미지 추출 시작:', text.substring(0, 200) + '...');
  console.log('텍스트 전체 길이:', text.length);
  
  // 텍스트에 이미지 패턴이 있는지 먼저 확인
  const hasImagePattern = text.includes('[이미지');
  console.log('[이미지] 패턴 존재:', hasImagePattern);
  
  // 텍스트에 Supabase 도메인이 포함되어 있는지 검사
  const hasSupabaseDomain = text.includes('ywvoksfszaelkceectaa.supabase.co');
  console.log('Supabase URL 존재:', hasSupabaseDomain);
  
  // 원본 텍스트 출력 (디버깅용)
  console.log('원본 텍스트 (전체):', text);
  
  // 이미지 패턴들 시도
  
  // 1. 기본 패턴: [이미지 숫자] 다음 줄에 URL
  const pattern1 = /\[이미지\s*(\d+)\][^\n]*\n(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
  
  // 2. @ 문자가 붙은 URL 패턴
  const pattern2 = /\[이미지\s*(\d+)\][^\n]*\n@(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
  
  // 3. 간단한 패턴: [이미지 숫자]와 URL이 같은 줄에 있는 경우
  const pattern3 = /\[이미지\s*(\d+)\][^\n]*\s+(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
  
  // 4. 이미지 패턴과 URL 사이에 여러 줄이 있는 경우
  const pattern4 = /\[이미지\s*(\d+)\][^\n]*\n(?:(?!https?:\/\/)[^\n]*\n)*?(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
  
  // 5. 추가 패턴: [이미지 숫자]와 URL 사이에 다른 텍스트가 있는 경우
  const pattern5 = /\[이미지\s*(\d+)\].*?(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gims;
  
  // 6. 패턴 없이 순수 Supabase URL만 추출
  const pattern6 = /https?:\/\/ywvoksfszaelkceectaa\.supabase\.co\/storage\/v1\/object\/public\/images\/[^\s\n?]+(?:\?[^\s\n]*)?/gi;
  
  // 패턴별 매치 시도 및 로그
  const tryPattern = (pattern: RegExp, patternName: string) => {
    try {
      let match;
      let matchCount = 0;
      
      while ((match = pattern.exec(text)) !== null) {
        // 패턴 6만 특별 처리 (이미지 번호 없음)
        if (patternName === "순수 URL 패턴") {
          const imageUrl = match[0].trim();
          matchCount++;
          console.log(`${patternName} 매치 #${matchCount}: ${imageUrl.substring(0, 50)}...`);
          
          // 이미 추가된 URL인지 확인 (중복 방지)
          if (!images.some(img => img.url === imageUrl)) {
            images.push({ 
              url: imageUrl, 
              page: String(matchCount), 
              relevance_score: 0.5 // 기본값 (신뢰도 낮음)
            });
          }
          continue;
        }
        
        // 일반 패턴 처리
        const imageNum = match[1];
        let imageUrl = match[2]?.trim();
        
        if (!imageUrl) continue;
        
        // URL이 ?로 끝나면 제거
        if (imageUrl.endsWith('?')) {
          imageUrl = imageUrl.slice(0, -1);
        }
        
        matchCount++;
        console.log(`${patternName} 매치 #${matchCount}: [${imageNum}] ${imageUrl.substring(0, 100)}...`);
        
        // 이미 추가된 URL인지 확인 (중복 방지)
        if (!images.some(img => img.url === imageUrl)) {
          images.push({ 
            url: imageUrl, 
            page: imageNum, 
            relevance_score: 0.8 // 기본값
          });
        }
      }
      
      console.log(`${patternName} 총 매치 수:`, matchCount);
      return matchCount;
    } catch (error) {
      console.error(`${patternName} 매칭 오류:`, error);
      return 0;
    }
  };
  
  // 모든 패턴 시도
  let totalMatches = 0;
  totalMatches += tryPattern(pattern1, "기본 패턴");
  totalMatches += tryPattern(pattern2, "@ 패턴");
  totalMatches += tryPattern(pattern3, "한 줄 패턴");
  totalMatches += tryPattern(pattern4, "여러 줄 패턴");
  totalMatches += tryPattern(pattern5, "혼합 패턴");
  
  console.log("패턴 매칭 이미지 총 수:", totalMatches);
  
  // 백업 패턴: 이미지 패턴이 없지만 Supabase URL은 있는 경우 직접 추출
  if (images.length === 0 && hasSupabaseDomain) {
    console.log("주 패턴 실패, 순수 URL 추출 시도");
    totalMatches += tryPattern(pattern6, "순수 URL 패턴");
  }
  
  // 결과 로깅
  console.log('최종 추출된 이미지 URL 수:', images.length);
  if (images.length > 0) {
    console.log('첫 번째 이미지 URL:', images[0].url);
    // 모든 이미지 URL 로깅
    images.forEach((img, idx) => {
      console.log(`이미지 #${idx+1}, 페이지: ${img.page}, URL: ${img.url.substring(0, 50)}...`);
    });
  } else {
    console.log('추출된 이미지 URL 없음');
    // 별도 검증 시도: 일반 텍스트에서 URL 추출
    console.log('전체 텍스트 길이:', text.length);
    const directUrls = text.match(/https?:\/\/[^\s\n]+/g);
    console.log('직접 추출된 이미지 URL 없음');
    console.log('텍스트에서 발견된 모든 URL 패턴:', directUrls?.length || 0);
    if (directUrls && directUrls.length > 0) {
      console.log('첫 번째 URL:', directUrls[0]);
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