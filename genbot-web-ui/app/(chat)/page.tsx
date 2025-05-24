import { cookies } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';

import { Chat } from '@/components/chat';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import PageContent from './page-content';

// 서버 컴포넌트
export default async function Page() {
  try {
    // 세션 확인 (로그인 여부 확인)
    const session = await auth();
    const isLoggedIn = !!session?.user;

    const id = generateUUID();

    const cookieStore = await cookies();
    const modelIdFromCookie = cookieStore.get('chat-model');
    const selectedChatModel = modelIdFromCookie ? modelIdFromCookie.value : DEFAULT_CHAT_MODEL;

    return <PageContent 
      id={id} 
      selectedChatModel={selectedChatModel} 
      isLoggedIn={isLoggedIn} 
      session={session} 
    />;
  } catch (error) {
    console.error('[CHAT] 오류 발생:', error);
    // 오류 발생 시 기본 UI 표시
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <h1 className="text-2xl font-bold text-gray-800">오류가 발생했습니다</h1>
        <p className="mt-2 text-gray-600">잠시 후 다시 시도해주세요.</p>
        <Button className="mt-4 bg-[#FF0235] hover:bg-[#FF0235]/80 text-white" variant="outline" asChild>
          <Link href="/">홈으로 돌아가기</Link>
        </Button>
      </div>
    );
  }
}
