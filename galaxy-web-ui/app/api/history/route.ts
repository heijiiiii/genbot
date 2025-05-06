import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ywvoksfszaelkceectaa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dm9rc2ZzemFlbGtjZWVjdGFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTU0ODUyMCwiZXhwIjoyMDYxMTI0NTIwfQ.KBkf30JIVTc-k0ysyZ_Fen1prSkNZe-p4c2nL6T37hE";

// Supabase 클라이언트 설정
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// UUID 형식 검증 함수
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// 테스트용 알려진 사용자 ID 목록
const KNOWN_USER_IDS = [
  "0f705e4c-9270-4dd4-8b55-5f46ec04c196",
  "58e0ea15-3c59-46aa-bd69-3751bb0a0b4b",
  "00000000-0000-0000-0000-000000000001"
];

export async function GET(request: NextRequest) {
  console.log("===== GET /api/history API 호출됨 =====");
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');
  
  // 세션 ID 또는 현재 시간을 가져옴 (세션별 채팅 필터링용)
  const sessionId = searchParams.get('session_id') || '';
  
  console.log(`요청 파라미터: limit=${limit}, startingAfter=${startingAfter}, endingBefore=${endingBefore}, sessionId=${sessionId}`);

  if (startingAfter && endingBefore) {
    console.log("오류: starting_after와 ending_before가 동시에 제공됨");
    return Response.json(
      'Only one of starting_after or ending_before can be provided!',
      { status: 400 },
    );
  }

  const session = await auth();
  
  // 디버깅 로그 추가
  console.log("세션 정보:", {
    인증상태: session?.user?.id ? "인증됨" : "인증 안됨",
    유저ID: session?.user?.id || "없음",
    이메일: session?.user?.email || "없음",
    이름: session?.user?.name || "없음"
  });

  if (!session?.user?.id) {
    console.log("오류: 인증되지 않은 사용자");
    return Response.json('Unauthorized!', { status: 401 });
  }

  try {
    // 현재 사용자 ID 로깅
    const currentUserId = session.user.id;
    console.log(`현재 사용자 ID: ${currentUserId}`);
    
    // 현재 세션의 채팅만 조회하기 위한 시간 계산 (지난 24시간 이내)
    const lastDay = new Date();
    lastDay.setHours(lastDay.getHours() - 24);
    const timeFilter = lastDay.toISOString();
    
    console.log(`시간 필터 적용: ${timeFilter} 이후의 채팅만 조회`);
    
    // 현재 세션의 채팅만 조회하는 쿼리 작성
    console.log(`Supabase 쿼리 시작: 최근 24시간 내의 채팅 조회`);
    
    let query = client
      .from('chats')
      .select('id, title, created_at, user_id')
      .gt('created_at', timeFilter) // 최근 24시간 이내의 채팅만 조회
      .order('created_at', { ascending: false })
      .limit(limit + 1);
    
    // 페이지네이션 처리
    if (startingAfter) {
      console.log(`startingAfter=${startingAfter} 이후 채팅 조회 중`);
      const { data: selectedChat } = await client
        .from('chats')
        .select('created_at')
        .eq('id', startingAfter)
        .single();

      if (selectedChat) {
        console.log(`기준 채팅 created_at: ${selectedChat.created_at}`);
        query = query.gt('created_at', selectedChat.created_at);
      } else {
        console.log(`startingAfter=${startingAfter}에 해당하는 채팅을 찾을 수 없음`);
      }
    } else if (endingBefore) {
      console.log(`endingBefore=${endingBefore} 이전 채팅 조회 중`);
      const { data: selectedChat } = await client
        .from('chats')
        .select('created_at')
        .eq('id', endingBefore)
        .single();

      if (selectedChat) {
        console.log(`기준 채팅 created_at: ${selectedChat.created_at}`);
        query = query.lt('created_at', selectedChat.created_at);
      } else {
        console.log(`endingBefore=${endingBefore}에 해당하는 채팅을 찾을 수 없음`);
      }
    }

    const { data: chats, error } = await query;

    if (error) {
      console.error('채팅 목록 조회 오류:', error);
      return Response.json('Failed to fetch chats!', { status: 500 });
    }

    console.log(`채팅 목록 조회 결과: ${chats?.length || 0}개의 채팅 발견`);
    if (chats && chats.length > 0) {
      console.log('첫 번째 채팅:', {
        id: chats[0].id,
        title: chats[0].title,
        created_at: chats[0].created_at,
        user_id: chats[0].user_id
      });
    } else {
      console.log('채팅 기록이 없습니다.');
    }
    
    const hasMore = chats && chats.length > limit;
    const result = {
      chats: hasMore ? chats.slice(0, limit) : chats,
      hasMore
    };

    console.log(`응답 데이터: ${result.chats.length}개 채팅, hasMore=${result.hasMore}`);
    return Response.json(result);
  } catch (error) {
    console.error('데이터베이스에서 채팅 목록 조회 실패:', error);
    return Response.json('Failed to fetch chats!', { status: 500 });
  }
} 