import { motion } from 'framer-motion';
import { SparklesIcon } from './icons';

export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-16 px-8 size-full flex flex-col justify-center items-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
        className="bg-gradient-to-r from-galaxy-blue to-galaxy-purple text-white p-3 rounded-full mb-6 shadow-galaxy-hover"
      >
        <SparklesIcon size={30} />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.5, type: "spring" }}
        className="text-3xl font-bold bg-gradient-to-r from-galaxy-blue to-galaxy-purple bg-clip-text text-transparent mb-2"
      >
        Galaxy S25 Assistant
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.6, type: "spring" }}
        className="text-lg text-zinc-500 text-center max-w-md whitespace-nowrap"
      >
        안녕하세요! Galaxy S25에 대해 어떤 도움이 필요하신가요?
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.7 }}
        className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg"
      >
        {[
          { title: "카메라 기능", description: "Galaxy S25의 최신 카메라 기능 알아보기" },
          { title: "배터리 성능", description: "배터리 최적화 및 절약 팁" },
          { title: "AI 기능", description: "Galaxy AI 기능과 사용법" },
          { title: "커스터마이징", description: "화면 및 시스템 설정 커스터마이징" }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="p-4 bg-white border border-galaxy-light rounded-xl shadow-galaxy hover:shadow-galaxy-hover transition-all duration-200 cursor-pointer transform hover:scale-[1.02] hover:bg-galaxy-light/20"
            onClick={() => {
              const inputEl = document.querySelector('[data-testid="multimodal-input"]') as HTMLTextAreaElement;
              if (inputEl) {
                // 텍스트 입력 설정
                inputEl.value = item.title;
                inputEl.focus();
                
                // 입력 변경 이벤트 발생 - React 이벤트를 위한 처리 추가
                const event = new Event('input', { bubbles: true, cancelable: true });
                inputEl.dispatchEvent(event);
                
                // 직접 setInput 호출을 위한 좀 더 확실한 방법
                try {
                  // @ts-ignore - 전역 객체 접근
                  if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
                    // 입력 값 강제 업데이트 시도
                    const changeEvent = new Event('change', { bubbles: true });
                    inputEl.dispatchEvent(changeEvent);
                  }
                } catch (e) {
                  console.error('React state 업데이트 시도 중 오류:', e);
                }
                
                // 지연 시간 후 전역 함수 호출
                setTimeout(() => {
                  try {
                    // @ts-ignore - 전역 함수 호출
                    if (typeof window.submitGalaxyForm === 'function') {
                      // @ts-ignore
                      window.submitGalaxyForm();
                      console.log('전역 제출 함수 호출됨');
                      return;
                    }
                    
                    // 기존 폴백 방식들
                    const sendButton = document.querySelector('[data-testid="send-button"]');
                    if (sendButton && sendButton instanceof HTMLButtonElement) {
                      sendButton.click();
                      console.log('전송 버튼 클릭됨');
                      return;
                    }
                    
                    const form = inputEl.closest('form');
                    if (form) {
                      console.log('폼 제출 시도');
                      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                      form.dispatchEvent(submitEvent);
                      return;
                    }
                    
                    console.log('Enter 키 이벤트 발생 시도');
                    const enterEvent = new KeyboardEvent('keydown', {
                      key: 'Enter',
                      code: 'Enter',
                      which: 13,
                      keyCode: 13,
                      bubbles: true,
                      cancelable: true
                    });
                    inputEl.dispatchEvent(enterEvent);
                  } catch (e) {
                    console.error('자동 제출 시도 중 오류:', e);
                  }
                }, 500); // 타이밍을 500ms로 늘림
              }
            }}
          >
            <h3 className="font-medium text-galaxy-blue">{item.title}</h3>
            <p className="text-sm text-zinc-500">{item.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
