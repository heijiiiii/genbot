'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import type { Session } from 'next-auth';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import HUDQuestionCards from '@/components/hud-question-cards';
import GenesisChatWidget from '@/components/GenesisChatWidget';

// 로그인/회원가입 모달 컴포넌트
const AuthModal = ({ 
  isOpen, 
  onOpenChange, 
  isLogin = true 
}: { 
  isOpen: boolean; 
  onOpenChange: (open: boolean) => void; 
  isLogin?: boolean;
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isLogin ? '로그인' : '회원가입'}</DialogTitle>
          <DialogDescription>
            {isLogin 
              ? 'Genesis G80 도우미 서비스를 이용하기 위해 로그인해주세요.' 
              : '새로운 계정을 만들어 Genesis G80 도우미 서비스를 이용해보세요.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" placeholder="example@email.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" type="password" />
          </div>
          {!isLogin && (
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input id="confirmPassword" type="password" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {isLogin && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/register">계정이 없으신가요?</Link>
            </Button>
          )}
          <Button type="button" className="w-full sm:w-auto bg-[#9D8A68] hover:bg-[#9D8A68]/80">
            {isLogin ? '로그인' : '회원가입'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 클라이언트 컴포넌트
export default function PageContent({
  id,
  selectedChatModel,
  isLoggedIn,
  session
}: {
  id: string;
  selectedChatModel: string;
  isLoggedIn: boolean;
  session: Session | null;
}) {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // HUD 질문 선택 처리 함수
  const handleQuestionSelect = (question: string) => {
    setInputValue(question);
    // 입력창에 자동 포커스 구현 가능
    if (detailsRef.current && !detailsRef.current.open) {
      detailsRef.current.open = true;
      setIsChatOpen(true);
    }
  };

  // 컴포넌트가 마운트된 후에만 상태 변경
  useEffect(() => {
    // 클라이언트 측에서만 실행
    setIsChatOpen(true);
    
    if (detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, []);

  // details 요소의 open 상태 변화 감지
  useEffect(() => {
    const detailsElement = detailsRef.current;
    
    const handleToggle = () => {
      if (detailsElement) {
        setIsChatOpen(detailsElement.open);
      }
    };

    if (detailsElement) {
      detailsElement.addEventListener('toggle', handleToggle);
    }

    return () => {
      if (detailsElement) {
        detailsElement.removeEventListener('toggle', handleToggle);
      }
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      {/* 로그인/회원가입 모달 */}
      <AuthModal isOpen={loginModalOpen} onOpenChange={setLoginModalOpen} isLogin={true} />
      <AuthModal isOpen={registerModalOpen} onOpenChange={setRegisterModalOpen} isLogin={false} />

      {/* 헤더 */}
      <header className="py-4 px-6 md:px-10 flex justify-between items-center">
        <div className="flex items-center">
          <div className="flex items-center">
            <Image 
              src="/genlogo1.png" 
              alt="Genesis Logo" 
              width={60} 
              height={60} 
              className="mr-2" 
            />
            <h1 className="text-xl font-semibold">Genesis G80</h1>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            className="bg-transparent hover:bg-gray-100 text-gray-800 border border-gray-300 px-4 py-2 text-sm"
            onClick={() => setLoginModalOpen(true)}
          >
            로그인
          </Button>
          <Button 
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 text-sm"
            onClick={() => setRegisterModalOpen(true)}
          >
            회원가입
          </Button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 flex flex-col">
        {/* 차량 이미지 섹션 - 여백을 줄인 레이아웃 */}
        <section className="w-full bg-white relative">
          {/* 회색 띠 (설명 텍스트 배경) */}
          <div className="absolute left-0 right-0 bg-gray-100 z-0" style={{ top: 'calc(40% - 100px)', height: '35%' }} />
          
          <div className="max-w-[1200px] mx-auto relative z-10 flex flex-col md:flex-row items-center">
            <div className="w-full md:w-1/2 flex justify-center">
              <Image 
                src="/gen80.png" 
                alt="Genesis G80" 
                width={600} 
                height={400} 
                className="object-contain" 
                priority
              />
            </div>
            <div className="w-full md:w-1/2 p-4 space-y-4">
              <p className="text-[#9D8A68] uppercase tracking-wider font-semibold">
                QUIET. POWERFUL. ELEGANT.
              </p>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
                GENESIS G80
              </h1>
              
              <h2 className="text-xl md:text-2xl font-semibold text-gray-800 tracking-normal">
                INTELLIGENT ASSISTANT
              </h2>
              
              <p className="text-gray-600 leading-relaxed tracking-wide">
                The perfect driving companion with advanced intelligence 
                and seamless connectivity. Ask any question about your
                vehicle's features, maintenance, or driving experience.
              </p>

              <div className="grid grid-cols-3 mt-4 divide-x divide-gray-300">
                <div className="text-center pr-4">
                  <h3 className="text-2xl font-bold text-[#9D8A68]">24/7</h3>
                  <p className="text-sm text-gray-700 uppercase mt-1 font-medium">ASSISTANCE</p>
                </div>
                <div className="text-center px-4">
                  <h3 className="text-2xl font-bold text-[#9D8A68]">100%</h3>
                  <p className="text-sm text-gray-700 uppercase mt-1 font-medium">ACCURACY</p>
                </div>
                <div className="text-center pl-4">
                  <h3 className="text-2xl font-bold text-[#9D8A68]">500+</h3>
                  <p className="text-sm text-gray-700 uppercase mt-1 font-medium">TOPICS</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 히어로 섹션 하단에 HUD 질문 카드 */}
          <div className="relative z-20 mt-6 mb-4">
            <HUDQuestionCards onSelect={handleQuestionSelect} />
          </div>
        </section>
      </main>

      {/* 새로운 GenesisChatWidget 컴포넌트 적용 */}
      <GenesisChatWidget />

      {/* 기존 챗봇 섹션 - 주석 처리
      <section className="bg-gray-50 py-8 px-6 border-t border-gray-200" style={{ marginTop: '-150px' }}>
        <div className="max-w-4xl mx-auto">
          <div className="border-t border-gray-300 mb-4" />
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
            <div className="h-2 bg-gray-800 w-full" />
            
            <button
              type="button"
              className="w-full p-4 flex items-center cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none border-b border-gray-100 text-left"
              onClick={() => setIsChatOpen(!isChatOpen)}
              aria-expanded={isChatOpen}
              aria-controls="chat-content"
            >
              <div className="w-2 h-2 mr-2 bg-[#9D8A68] rounded-full" />
              <span className="font-semibold text-gray-800">GENESIS MANUAL ASSISTANT</span>
              <span className="ml-auto flex items-center justify-center">
                <div className="relative w-6 h-6 flex items-center justify-center border border-[#9D8A68] rounded-full">
                  <span className="absolute h-0.5 w-3 bg-[#9D8A68] transition-transform" />
                  <span className={`absolute h-3 w-0.5 bg-[#9D8A68] transition-transform duration-300 ${isChatOpen ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`} />
                </div>
              </span>
            </button>
            
            <div 
              id="chat-content"
              className={`transition-all duration-300 ease-in-out overflow-hidden ${isChatOpen ? 'max-h-[400px]' : 'max-h-0'}`}
              aria-hidden={!isChatOpen}
              style={{ 
                scrollbarColor: '#333 #f5f5f5',
              }}
            >
              <div className="py-6 px-4 max-h-[400px] overflow-y-auto" style={{
                scrollbarWidth: 'thin',
              }}>
                <style jsx>{`
                  div::-webkit-scrollbar {
                    width: 8px;
                  }
                  div::-webkit-scrollbar-track {
                    background: #f5f5f5;
                  }
                  div::-webkit-scrollbar-thumb {
                    background-color: #333;
                    border-radius: 10px;
                  }
                `}</style>
                
                <div className="mb-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">G</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                        <p className="text-gray-800 text-[15px] leading-relaxed">
                          안녕하세요! 자동차에 대해 궁금한 점이 있으시면 언제든지 질문해 주세요. 어떻게 도와드릴 수 있을까요?
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-start justify-end">
                    <div className="bg-gray-100 p-3 rounded-lg text-[15px] text-gray-800 max-w-[75%]">
                      운전대 위치는?
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">G</span>
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                        <p className="text-gray-800 text-[15px] leading-relaxed">                            
                          운전대의 위치는 일반적으로 차량의 제조 국가와 운전이 이루어지는 국가에 따라 다릅니다. 대부분의 국가에서는 운전대가 왼쪽에 위치해 있으며, 이는 차량이 도로의 오른쪽을 주행하도록 설계된 경우입니다. 반면에, 영국, 일본, 호주 등 일부 국가에서는 운전대가 오른쪽에 위치해 있으며, 이 경우 차량은 도로의 왼쪽을 주행합니다. 차량을 구매하거나 운전할 때는 해당 국가의 도로 규정을 확인하는 것이 중요합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100 p-4 bg-white relative z-10">
              <div className="flex items-center bg-white border-2 border-[#9D8A68] rounded-full px-4 py-2">
                <input 
                  type="text" 
                  placeholder="Ask a question about your Genesis..." 
                  className="flex-1 px-2 py-1 outline-none text-gray-700 bg-transparent"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button className="bg-[#9D8A68] text-white rounded-full p-2 w-8 h-8 flex items-center justify-center" type="button">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <title>전송 아이콘</title>
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </button>
              </div>
              
              <div className="text-center mt-3">
                <p className="text-xs text-gray-500">
                  <svg className="inline-block w-3 h-3 mr-1 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <title>잠금 아이콘</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>로그인하시면 대화 내용이 저장됩니다.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}

      {/* 실제 챗봇 (화면에 보이지 않게 처리) */}
      <div className="hidden">
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          selectedChatModel={selectedChatModel}
          selectedVisibilityType="private"
          isReadonly={false}
          session={session}
          registerChatMapping={isLoggedIn}
        />
        <DataStreamHandler id={id} />
      </div>
    </div>
  );
} 