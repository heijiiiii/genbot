import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/constants';

// Stream 챗봇 응답
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, selectedChatModel } = body;
    
    // 이전 대화 내용 가져오기 (필요한 경우)
    let history = [];
    if (message.previous) {
      history = message.previous.map((msg: any) => ({
        user: msg.role === 'user' ? msg.content : '',
        ai: msg.role === 'assistant' ? msg.content : '',
      })).filter((msg: any) => msg.user || msg.ai);
    }
    
    // FastAPI 요청 생성
    const payload = {
      message: message.content,
      history: history,
      debug_mode: false,
    };
    
    // FastAPI 서버로 요청 전송
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `API 서버 오류: ${error}` },
        { status: response.status }
      );
    }
    
    // 응답 데이터 처리
    const data = await response.json();
    
    // 이미지 URL 처리
    let images = [];
    if (data.images && data.images.length > 0) {
      images = data.images.map((img: any) => ({
        url: img.url,
        page: img.page,
        relevance_score: img.relevance_score || 0,
      }));
    }
    
    // 클라이언트에 응답 반환
    return NextResponse.json({
      id: Date.now().toString(),
      role: 'assistant',
      content: data.answer,
      images: images,
    });
  } catch (error: any) {
    console.error('챗봇 API 오류:', error);
    return NextResponse.json(
      { error: `처리 중 오류 발생: ${error.message}` },
      { status: 500 }
    );
  }
} 