'use client';

import { useState } from 'react';

const questions = [
  "스마트 크루즈 기능 작동방법은?",
  "디지털 키 등록 방법이 궁금해요.",
  "차량 점검 알림이 떴어요."
];

export default function HUDQuestionCards({ 
  onSelect
}: { 
  onSelect: (q: string) => void
}) {
  // 모든 질문 사용
  const displayQuestions = questions;
  
  const handleSelect = (question: string) => {
    onSelect(question);
  };

  return (
    <div className="flex flex-col md:flex-row justify-center gap-5 md:gap-[20px] pb-16 mb-8 mt-[30px] z-30">
      {displayQuestions.map((question) => (
        <button
          key={`question-${question.substring(0, 10)}`}
          className="backdrop-blur-md bg-black/30 text-white border border-white/20 rounded-xl shadow-lg px-6 py-5 cursor-pointer hover:shadow-[#9D8A68]/40 hover:bg-black/40 transition-all duration-300 w-full md:w-1/3 max-w-xs text-center min-h-[100px] flex items-center justify-center"
          onClick={() => handleSelect(question)}
          type="button"
        >
          <p className="text-sm md:text-base font-medium tracking-wide">
            {question}
          </p>
        </button>
      ))}
    </div>
  );
} 