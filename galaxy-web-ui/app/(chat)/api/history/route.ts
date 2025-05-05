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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    return Response.json(
      'Only one of starting_after or ending_before can be provided!',
      { status: 400 },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  // 사용자 ID 검증 및 변환
  let userId = session.user.id;
  
  // 게스트 ID가 UUID 형식이 아니면 기본 UUID 사용
  if (!isValidUUID(userId)) {
    console.log(`사용자 ID ${userId}는 UUID 형식이 아닙니다. 기본 UUID를 사용합니다.`);
    // 게스트 사용자에게 고정 UUID 할당 (테스트용)
    userId = "00000000-0000-0000-0000-000000000001";
  }

  try {
    // Supabase로 채팅 목록 조회
    let query = client
      .from('chats')
      .select('id, title, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // 페이지네이션 처리
    if (startingAfter) {
      const { data: selectedChat } = await client
        .from('chats')
        .select('created_at')
        .eq('id', startingAfter)
        .single();

      if (selectedChat) {
        query = query.gt('created_at', selectedChat.created_at);
      }
    } else if (endingBefore) {
      const { data: selectedChat } = await client
        .from('chats')
        .select('created_at')
        .eq('id', endingBefore)
        .single();

      if (selectedChat) {
        query = query.lt('created_at', selectedChat.created_at);
      }
    }

    const { data: chats, error } = await query;

    if (error) {
      console.error('채팅 목록 조회 오류:', error);
      return Response.json('Failed to fetch chats!', { status: 500 });
    }

    const hasMore = chats && chats.length > limit;
    const result = {
      chats: hasMore ? chats.slice(0, limit) : chats,
      hasMore
    };

    return Response.json(result);
  } catch (error) {
    console.error('Failed to get chats by user from database:', error);
    return Response.json('Failed to fetch chats!', { status: 500 });
  }
}
