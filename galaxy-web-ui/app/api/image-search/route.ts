import { API_BASE_URL } from '@/lib/constants';
import { NextResponse } from 'next/server';
import type { ImageData } from '@/lib/ai';

// 렌더 백엔드 서버 URL
const RENDER_BACKEND_URL = 'https://galaxy-rag-chatbot.onrender.com';

// 이미지 검색 API 라우트
export async function POST(request: Request) {
  try {
    // 요청 본문 파싱
    const json = await request.json();
    const query = json.query;

    if (!query) {
      return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 });
    }

    console.log('이미지 검색 요청:', query);

    // 백엔드 API 호출 (렌더 서버)
    // API_BASE_URL 대신 렌더 백엔드 직접 호출
    const backendUrl = `${RENDER_BACKEND_URL}/image-search`;
    console.log('백엔드 호출 URL:', backendUrl);

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        console.error('백엔드 서버 오류:', response.status, response.statusText);
        return NextResponse.json(
          { error: '백엔드 서버에서 오류가 발생했습니다.' },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('이미지 검색 결과:', {
        success: !!data,
        imageCount: data.images?.length || 0
      });

      // 이미지 응답이 없거나 형식이 잘못된 경우 처리
      if (!data || !data.images) {
        // 기본 이미지 제공
        const defaultImages: ImageData[] = [
          {
            url: 'https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/galaxy_s25_figure_p14_mid_de9837a9.jpg',
            page: '14',
            relevance_score: 0.8
          }
        ];

        return NextResponse.json({
          images: defaultImages,
          fallback: true,
          message: '관련 이미지를 찾을 수 없어 기본 이미지를 제공합니다.'
        });
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error('백엔드 API 호출 중 오류:', error);
      
      // 오류 발생 시 기본 이미지 제공
      const fallbackImages: ImageData[] = [
        {
          url: 'https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/galaxy_s25_figure_p14_mid_de9837a9.jpg',
          page: '14',
          relevance_score: 0.8
        }
      ];

      return NextResponse.json({
        images: fallbackImages,
        fallback: true,
        error: `백엔드 연결 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      });
    }
  } catch (error) {
    console.error('이미지 검색 처리 중 오류:', error);
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 이미지 검색 상태 확인용 GET 엔드포인트
export async function GET() {
  return NextResponse.json({
    status: 'active',
    message: '이미지 검색 API가 활성화되어 있습니다. POST 요청으로 검색어를 전송하세요.'
  });
} 