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

// 사용자 ID 매핑 확인 함수
const getUserIdMapping = async (nextAuthId: string) => {
  // 1. 매핑 테이블에서 먼저 확인
  const { data: mapping, error: mappingError } = await client
    .from('user_mappings')
    .select('supabase_id')
    .eq('next_auth_id', nextAuthId)
    .single();

  if (!mappingError && mapping && mapping.supabase_id) {
    console.log(`매핑 테이블에서 ID 찾음: ${nextAuthId} -> ${mapping.supabase_id}`);
    return mapping.supabase_id;
  }

  // 2. 매핑이 없으면 기본 ID 목록 사용
  console.log(`매핑 테이블에서 ID를 찾지 못함: ${nextAuthId}. 기본 ID 목록 사용`);
  const allPossibleIds = [nextAuthId, ...KNOWN_USER_IDS];
  return allPossibleIds;
};

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
    
    // 매핑 테이블을 통해 사용 가능한 사용자 ID 목록 가져오기
    const userIds = await getUserIdMapping(currentUserId);
    console.log(`조회할 사용자 ID: ${Array.isArray(userIds) ? userIds.join(', ') : userIds}`);
    
    // 모든 채팅 조회 쿼리 생성
    let query = client
      .from('chats')
      .select('id, title, created_at, user_id');
    
    // 단일 ID인 경우 eq, 다중 ID인 경우 in 사용  
    if (Array.isArray(userIds)) {
      query = query.in('user_id', userIds);
      console.log(`여러 사용자 ID로 채팅 조회 중: ${userIds.length}개 ID`);
    } else {
      query = query.eq('user_id', userIds);
      console.log(`단일 사용자 ID로 채팅 조회 중: ${userIds}`);
    }
    
    // 최신순 정렬 및 제한 적용
    query = query
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
      console.log(`오류 세부 정보: ${JSON.stringify(error)}`);
      
      // 스키마 오류일 경우 다른 필드명으로 시도해보기
      if (error.message && (error.message.includes('column') || error.message.includes('field'))) {
        console.log("필드명 오류 가능성 있음. 다양한 필드명 형식 시도");
        
        // 1. userId 필드 시도
        console.log("시도 1: 'userId' 필드로 검색");
        const { data: altChats1, error: altError1 } = await client
          .from('chats')
          .select('id, title, created_at, userId')
          .eq('userId', currentUserId)
          .order('created_at', { ascending: false })
          .limit(limit + 1);
          
        if (!altError1 && altChats1 && altChats1.length > 0) {
          console.log(`'userId' 필드 조회 성공: ${altChats1.length}개 채팅 발견`);
          // 원래 포맷으로 변환
          const transformedChats = altChats1.map(chat => ({
            id: chat.id,
            title: chat.title,
            created_at: chat.created_at,
            user_id: chat.userId
          }));
          
          const hasMore = transformedChats.length > limit;
          const result = {
            chats: hasMore ? transformedChats.slice(0, limit) : transformedChats,
            hasMore
          };
          
          return Response.json(result);
        } else {
          console.log(`'userId' 필드 조회 실패: ${altError1?.message || "알 수 없는 오류"}`);
        }
        
        // 2. userid 필드 시도
        console.log("시도 2: 'userid' 필드로 검색");
        const { data: altChats2, error: altError2 } = await client
          .from('chats')
          .select('id, title, created_at, userid')
          .eq('userid', currentUserId)
          .order('created_at', { ascending: false })
          .limit(limit + 1);
          
        if (!altError2 && altChats2 && altChats2.length > 0) {
          console.log(`'userid' 필드 조회 성공: ${altChats2.length}개 채팅 발견`);
          // 원래 포맷으로 변환
          const transformedChats = altChats2.map(chat => ({
            id: chat.id,
            title: chat.title,
            created_at: chat.created_at,
            user_id: chat.userid
          }));
          
          const hasMore = transformedChats.length > limit;
          const result = {
            chats: hasMore ? transformedChats.slice(0, limit) : transformedChats,
            hasMore
          };
          
          return Response.json(result);
        } else {
          console.log(`'userid' 필드 조회 실패: ${altError2?.message || "알 수 없는 오류"}`);
        }
        
        // 3. 마지막 대안: Supabase에서 직접 테이블 스키마 정보 가져오기
        console.log("시도 3: Supabase에서 테이블 정보 조회");
        try {
          // 테이블 정보 조회를 통해 필드명 확인
          const { data: tableInfo, error: tableError } = await client.rpc('get_table_definition', {
            table_name: 'chats'
          });
          
          if (!tableError && tableInfo) {
            console.log(`chats 테이블 정보: ${JSON.stringify(tableInfo)}`);
          } else {
            console.log(`테이블 정보 조회 실패: ${tableError?.message || "알 수 없는 오류"}`);
          }
        } catch (infoError) {
          console.log(`테이블 정보 조회 중 예외 발생: ${infoError}`);
        }
      }
      
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