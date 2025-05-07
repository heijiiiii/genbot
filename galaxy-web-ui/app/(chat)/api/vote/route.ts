import { auth } from '@/app/(auth)/auth';
import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ywvoksfszaelkceectaa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dm9rc2ZzemFlbGtjZWVjdGFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTU0ODUyMCwiZXhwIjoyMDYxMTI0NTIwfQ.KBkf30JIVTc-k0ysyZ_Fen1prSkNZe-p4c2nL6T37hE";

// Supabase 클라이언트 설정
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: true,
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        // IPv4만 사용하도록 강제
        headers: {
          ...options?.headers,
          'Family-Preference': 'IPv4', // 이 헤더는 프록시나 서버 설정에 따라 작동할 수 있음
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
    }
  }
});

// UUID 형식 검증 함수
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('chatId is required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 사용자 ID 검증 및 변환
  let userId = session.user.id;
  
  // 게스트 ID가 UUID 형식이 아니면 기본 UUID 사용
  if (!isValidUUID(userId)) {
    console.log(`사용자 ID ${userId}는 UUID 형식이 아닙니다. 기본 UUID를 사용합니다.`);
    // 게스트 사용자에게 고정 UUID 할당 (테스트용)
    userId = "00000000-0000-0000-0000-000000000001";
  }

  // Supabase로 채팅 조회
  const { data: chat, error: chatError } = await client
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .maybeSingle();

  if (chatError) {
    console.error('채팅 조회 오류:', chatError);
    
    // 채팅을 찾을 수 없을 때는 빈 배열 반환
    if (chatError.code === 'PGRST116') {
      console.log(`채팅 ID ${chatId}에 해당하는 채팅이 없습니다. 빈 배열을 반환합니다.`);
      return Response.json([], { status: 200 });
    }
    
    return new Response('Failed to get chat', { status: 500 });
  }

  if (!chat) {
    console.log(`채팅 ID ${chatId}에 해당하는 채팅이 없습니다. 빈 배열을 반환합니다.`);
    return Response.json([], { status: 200 });
  }

  if (chat.user_id !== userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Supabase로 투표 조회
  const { data: votes, error: votesError } = await client
    .from('votes_v2')
    .select('*')
    .eq('chat_id', chatId);

  if (votesError) {
    console.error('투표 조회 오류:', votesError);
    return new Response('Failed to get votes', { status: 500 });
  }

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: 'up' | 'down' } =
    await request.json();

  if (!chatId || !messageId || !type) {
    return new Response('messageId and type are required', { status: 400 });
  }

  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 사용자 ID 검증 및 변환
  let userId = session.user.id;
  
  // 게스트 ID가 UUID 형식이 아니면 기본 UUID 사용
  if (!isValidUUID(userId)) {
    console.log(`사용자 ID ${userId}는 UUID 형식이 아닙니다. 기본 UUID를 사용합니다.`);
    // 게스트 사용자에게 고정 UUID 할당 (테스트용)
    userId = "00000000-0000-0000-0000-000000000001";
  }

  // Supabase로 채팅 조회
  const { data: chat, error: chatError } = await client
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .maybeSingle();

  if (chatError) {
    console.error('채팅 조회 오류:', chatError);
    
    // 채팅을 찾을 수 없을 때는 빈 배열 반환
    if (chatError.code === 'PGRST116') {
      console.log(`채팅 ID ${chatId}에 해당하는 채팅이 없습니다. 빈 배열을 반환합니다.`);
      return Response.json([], { status: 200 });
    }
    
    return new Response('Failed to get chat', { status: 500 });
  }

  if (!chat) {
    console.log(`채팅 ID ${chatId}에 해당하는 채팅이 없습니다. 빈 배열을 반환합니다.`);
    return Response.json([], { status: 200 });
  }

  if (chat.user_id !== userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 투표 조회
  const { data: existingVote, error: existingVoteError } = await client
    .from('votes_v2')
    .select('*')
    .eq('message_id', messageId)
    .eq('chat_id', chatId);

  if (existingVoteError) {
    console.error('기존 투표 조회 오류:', existingVoteError);
    return new Response('Failed to get existing vote', { status: 500 });
  }

  let result;
  if (existingVote && existingVote.length > 0) {
    // 기존 투표 업데이트
    const { data, error } = await client
      .from('votes_v2')
      .update({ is_upvoted: type === 'up' })
      .eq('message_id', messageId)
      .eq('chat_id', chatId);
    
    result = { data, error };
  } else {
    // 새 투표 삽입
    const { data, error } = await client
      .from('votes_v2')
      .insert([{
        chat_id: chatId,
        message_id: messageId,
        is_upvoted: type === 'up'
      }]);
    
    result = { data, error };
  }

  if (result.error) {
    console.error('투표 저장 오류:', result.error);
    return new Response('Failed to vote message', { status: 500 });
  }

  return new Response('Message voted', { status: 200 });
}
