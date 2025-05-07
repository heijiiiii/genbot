import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/app/(auth)/auth';

// Supabase 설정
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ywvoksfszaelkceectaa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dm9rc2ZzemFlbGtjZWVjdGFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTU0ODUyMCwiZXhwIjoyMDYxMTI0NTIwfQ.KBkf30JIVTc-k0ysyZ_Fen1prSkNZe-p4c2nL6T37hE";

// Supabase 클라이언트 설정 (IPv4만 사용하도록 강제)
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

// 로그인 성공 후 매핑 테이블에 NextAuth ID와 Supabase ID 저장
// chatId를 포함하도록 수정
const saveUserIdMapping = async (nextAuthId: string, supabaseId: string, chatId?: string) => {
  if (!nextAuthId || !supabaseId) return;
  
  try {
    // chatId가 제공된 경우 해당 채팅에 대한 매핑 생성/업데이트
    if (chatId) {
      // 특정 채팅에 대한 매핑이 이미 있는지 확인
      const { data: existingChatMapping } = await client
        .from('user_mappings')
        .select('*')
        .eq('next_auth_id', nextAuthId)
        .eq('chat_id', chatId)
        .maybeSingle();
      
      if (existingChatMapping) {
        // 이미 존재하면 업데이트
        const { error: updateError } = await client
          .from('user_mappings')
          .update({ 
            supabase_id: supabaseId, 
            updated_at: new Date().toISOString() 
          })
          .eq('next_auth_id', nextAuthId)
          .eq('chat_id', chatId);
        
        if (updateError) {
          console.error(`채팅 ID ${chatId}에 대한 매핑 업데이트 실패:`, updateError);
        } else {
          console.log(`채팅 ID ${chatId}에 대한 매핑 업데이트 성공: ${nextAuthId} -> ${supabaseId}`);
        }
      } else {
        // 없으면 새로 생성
        const { error: insertError } = await client
          .from('user_mappings')
          .insert({
            next_auth_id: nextAuthId,
            supabase_id: supabaseId,
            chat_id: chatId,
            created_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`채팅 ID ${chatId}에 대한 매핑 생성 실패:`, insertError);
        } else {
          console.log(`채팅 ID ${chatId}에 대한 매핑 생성 성공: ${nextAuthId} -> ${supabaseId}`);
        }
      }
      return;
    }
    
    // 기본 매핑 (chatId 없는 경우) - 이전 로직 유지
    const { data: existingMapping } = await client
      .from('user_mappings')
      .select('*')
      .eq('next_auth_id', nextAuthId)
      .is('chat_id', null)
      .maybeSingle();
    
    if (existingMapping) {
      // 이미 존재하면 업데이트
      const { error: updateError } = await client
        .from('user_mappings')
        .update({ supabase_id: supabaseId, updated_at: new Date().toISOString() })
        .eq('next_auth_id', nextAuthId)
        .is('chat_id', null);
      
      if (updateError) {
        console.error('사용자 ID 매핑 업데이트 실패:', updateError);
      } else {
        console.log(`사용자 ID 매핑 업데이트 성공: ${nextAuthId} -> ${supabaseId}`);
      }
    } else {
      // 없으면 새로 생성
      const { error: insertError } = await client
        .from('user_mappings')
        .insert({
          next_auth_id: nextAuthId,
          supabase_id: supabaseId,
          chat_id: null, // 기본 매핑은 chat_id가 null
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('사용자 ID 매핑 생성 실패:', insertError);
      } else {
        console.log(`사용자 ID 매핑 생성 성공: ${nextAuthId} -> ${supabaseId}`);
      }
    }
  } catch (error) {
    console.error('매핑 테이블 처리 중 오류:', error);
  }
};

// 로그인 API 핸들러
export async function POST(request: NextRequest) {
  try {
    const { email, password, supabaseId, chatId } = await request.json();
    const session = await auth();
    
    if (!session?.user?.id) {
      return Response.json({ success: false, message: '인증되지 않은 사용자' }, { status: 401 });
    }
    
    const nextAuthId = session.user.id;
    
    // ID 매핑 저장 (chatId 포함)
    if (supabaseId) {
      await saveUserIdMapping(nextAuthId, supabaseId, chatId);
    } else {
      console.log('supabaseId가 제공되지 않아 매핑을 저장하지 않습니다');
    }
    
    return Response.json({ success: true, userId: nextAuthId });
  } catch (error) {
    console.error('로그인 처리 중 오류:', error);
    return Response.json({ success: false, message: '로그인 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
} 