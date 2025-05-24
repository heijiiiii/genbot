"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

export default function GenesisChatWidget() {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState(0);

  // 창 크기 변경 감지 및 스크롤 조정
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // 초기값 설정
    handleResize();
    
    // 이벤트 리스너 등록
    window.addEventListener('resize', handleResize);
    
    // 스크롤 조정
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    // 실제 전송 로직은 여기에 구현
    setInput("");
  };

  return (
    <div className="w-full h-full flex justify-center items-start py-8 bg-gray-100">
      <div className="w-full mx-auto px-4" style={{ maxWidth: "1024px" }}>
        <div className="rounded-2xl overflow-hidden shadow-lg relative">
          {/* 배경 레이어 - 시각적 계층감을 위한 회색 배경 */}
          <div className="absolute inset-0 bg-gray-200 transform translate-x-2 translate-y-2 rounded-2xl" />
          
          {/* 메인 채팅 컨테이너 */}
          <div className="w-full flex flex-col bg-white border border-gray-200 rounded-2xl relative z-10">
            {/* 상단 포인트 라인 */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-gray-300 via-gray-600 to-gray-300" />
            
            {/* 헤더 - 지네시스 브랜드 스타일 강화 */}
            <div className="bg-white px-8 py-5 flex-shrink-0 flex items-center justify-between relative">
              <div className="flex items-center">
                <span className="font-semibold text-sm tracking-wide text-[#111]">GENESIS MANUAL ASSISTANT</span>
              </div>
            </div>

            {/* 메시지 리스트 */}
            <div 
              ref={listRef} 
              className="flex-1 overflow-y-auto px-8 py-6 bg-white"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#ddd #fff', height: 'calc(100vh - 210px)' }}
            >
              <div className="flex items-start w-full">
                <div className="flex-shrink-0 w-8 h-8 bg-[#111] rounded-full flex items-center justify-center mr-3">
                  <span className="text-white text-xs">G</span>
                </div>
                <div className="bg-[#f9f9f9] p-4 rounded-2xl text-gray-800 shadow-sm">
                  Hello! I&apos;m your GENESIS Manual Assistant. How can I help you with your vehicle today?
                </div>
              </div>
            </div>

            {/* 입력창 - 지네시스 스타일 */}
            <div className="border-t border-gray-100 p-4 px-8 bg-white flex-shrink-0">
              <form onSubmit={handleSend} className="flex items-center">
                <div className="flex items-center bg-white border rounded-full px-4 py-3 w-full">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question about your Genesis..."
                    className="flex-1 outline-none text-gray-700 bg-transparent"
                  />
                  <button 
                    type="submit" 
                    className="bg-[#111] hover:bg-[#333] text-white rounded-full p-2 w-8 h-8 flex items-center justify-center ml-2 transition-colors"
                    aria-label="전송"
                  >
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
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 