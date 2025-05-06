import { type NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/constants';
import { extractImagesFromText } from '@/lib/ai';

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
      debug_mode: true, // 디버깅 모드 활성화
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
    
    // 응답 데이터 처리 - 전체 응답을 한번에 받아서 처리
    const data = await response.json();
    
    // 이미지 추출 및 처리 로직 개선: 이미지 패턴이 스트리밍 중에 분할되지 않도록 함
    let images = [];
    let processedContent = data.answer;
    
    // 이미지 패턴 추출
    const imageBlocks = [];
    const imageBlockPattern = /\[이미지\s*\d+\](?:[\s\S]*?)(?:https?:\/\/[^\s\n]+)/g;
    let imageBlockMatch;
    
    // 이미지 블록 전체를 찾아서 저장
    while ((imageBlockMatch = imageBlockPattern.exec(data.answer)) !== null) {
      imageBlocks.push(imageBlockMatch[0]);
    }
    
    // 갤럭시 관련 특정 파일 패턴 검사
    if (imageBlocks.length === 0) {
      const galaxyFilePattern = /galaxy_s25_[a-z]+_p(\d+)_(?:top|mid|bot)_[a-f0-9]+\.jpg/gi;
      let fileNameMatch;
      
      while ((fileNameMatch = galaxyFilePattern.exec(data.answer)) !== null) {
        const fileName = fileNameMatch[0];
        console.log('갤럭시 이미지 파일 패턴 발견:', fileName);
        
        // 파일명에서 페이지 번호 추출 시도
        const pageMatch = fileName.match(/_p(\d+)_/i);
        const pageNumber = pageMatch ? pageMatch[1] : '1';
        
        // 파일명으로 이미지 블록 생성
        const fileImageBlock = `[이미지 ${pageNumber}]\nhttps://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/${fileName}`;
        imageBlocks.push(fileImageBlock);
      }
    }
    
    // 1. API가 직접 이미지를 제공하는 경우 사용
    if (data.images && data.images.length > 0) {
      console.log('API에서 제공한 이미지 사용:', data.images.length);
      images = data.images.map((img: any) => ({
        url: img.url,
        page: img.page,
        relevance_score: img.relevance_score || 0,
      }));
    } 
    // 2. 텍스트에서 이미지 추출
    else {
      console.log('텍스트에서 이미지 추출 시도');
      const extractedImages = extractImagesFromText(data.answer);
      
      if (extractedImages && extractedImages.length > 0) {
        console.log('텍스트에서 이미지 추출 성공:', extractedImages.length);
        images = extractedImages;
      }
    }
    
    // 클라이언트에 응답 반환 - 이미지 데이터와 이미지 블록 정보를 함께 전송
    return NextResponse.json({
      id: Date.now().toString(),
      role: 'assistant',
      content: processedContent,
      images: images,
      imageBlocks: imageBlocks // 이미지 패턴이 포함된 블록 정보 추가
    });
  } catch (error: any) {
    console.error('챗봇 API 오류:', error);
    return NextResponse.json(
      { error: `처리 중 오류 발생: ${error.message}` },
      { status: 500 }
    );
  }
} 