import {
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { generateUUID, } from '@/lib/utils';
import { createClient } from '@supabase/supabase-js';
import { CohereEmbeddings } from "@langchain/cohere";
import { Document } from "@langchain/core/documents";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import OpenAI from 'openai';
import { myProvider } from '@/lib/ai/providers';
import { isProductionEnvironment } from '@/lib/constants';

// 환경 변수 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COHERE_API_KEY = process.env.COHERE_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Supabase 클라이언트 설정
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 임베딩 모델 설정
const cohere_embeddings = new CohereEmbeddings({
  model: "embed-v4.0",
  apiKey: COHERE_API_KEY
});

// OpenAI 설정
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// 벡터 스토어 설정
const text_vectorstore = new SupabaseVectorStore(
  cohere_embeddings,
  {
    client,
    tableName: "text_embeddings",
    queryName: "match_text_embeddings"
  }
);

// API 응답에서 이미지 URL을 정규화하는 함수
function normalizeImageUrls(content: string): string {
  // 디버그 로그
  console.log('이미지 URL 정규화 처리 시작');
  console.log('원본 응답 일부:', content.substring(0, 200));
  
  // 이미지 패턴 감지
  const hasImagePattern = content.includes('[이미지');
  const hasSupabaseUrl = content.includes('ywvoksfszaelkceectaa.supabase.co');
  
  console.log('응답에 [이미지] 패턴 포함:', hasImagePattern);
  console.log('응답에 Supabase URL 포함:', hasSupabaseUrl);
  
  if (hasImagePattern) {
    const matches = content.match(/\[이미지[^\n]*\n[^\n]+/g);
    if (matches) {
      console.log('발견된 이미지 패턴 수:', matches.length);
      console.log('발견된 이미지 패턴:', matches);
    }
  }

  // URL에서 이중 슬래시를 단일 슬래시로 변환 (프로토콜 다음의 이중 슬래시는 제외)
  const result = content.replace(/([^:])\/\/+/g, '$1/');
  
  // 정규화 후 변화가 있는지 확인
  const isChanged = result !== content;
  console.log('URL 정규화 후 변경 발생:', isChanged);
  
  return result;
}

// 갤럭시 챗봇 검색 기능 구현
async function searchDocuments(query: string) {
  try {
    // 검색 쿼리 정규화
    const normalized_query = query.trim().replace(/[.!?]$/, '');
    
    try {
      // 쿼리 임베딩 생성
      const queryEmbedding = await cohere_embeddings.embedQuery(normalized_query);
      
      // 텍스트 검색 수행 - SQL 함수를 직접 호출하는 방식으로 변경
      try {
        const { data: vectorResults, error } = await client.rpc(
          'match_text_embeddings', 
          { 
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 5
          }
        );
        
        if (error) throw error;
        
        if (!vectorResults || vectorResults.length === 0) {
          return "매뉴얼에서 관련 정보를 찾을 수 없습니다.";
        }
        
        // 검색 결과를 Document 형식으로 변환
        const searchResults = vectorResults.map((item: { 
          id: string; 
          content: string; 
          metadata: any; 
          similarity: number;
        }) => {
          const doc = new Document({
            pageContent: item.content,
            metadata: item.metadata || {}
          });
          return [doc, item.similarity];
        });
        
        // 검색 결과 형식화
        let result_text = "";
        const reference_pages: string[] = [];
        
        for (const [doc, score] of searchResults) {
          result_text += `내용: ${doc.pageContent}\n`;
          if (doc.metadata?.category) {
            result_text += `카테고리: ${doc.metadata.category || '없음'}\n`;
          }
          if (doc.metadata?.page) {
            result_text += `페이지: ${doc.metadata.page || '없음'}\n`;
            
            // 참조 페이지 수집
            if (doc.metadata.page && !reference_pages.includes(doc.metadata.page)) {
              reference_pages.push(doc.metadata.page);
            }
          }
          result_text += "\n";
        }
        
        // 참조 페이지 정보 추가
        if (reference_pages.length > 0) {
          reference_pages.sort();
          result_text += "\n\n💡 추가 정보가 필요하면 매뉴얼의 관련 섹션을 참고해보세요.";
        }
        
        return result_text;
      } catch (rpcError) {
        console.error("RPC 호출 오류:", rpcError);
        throw rpcError;
      }
      
    } catch (vectorError) {
      console.error("벡터 검색 오류:", vectorError);
      
      // 벡터 검색 실패 시 기본 응답 제공
      return `
"갤럭시 S25 사용 관련 정보가 필요하시면 질문해 주세요. 현재 벡터 검색에 일시적인 문제가 있지만, 일반적인 질문에 대해서는 답변해 드릴 수 있습니다."

기기에 대한 기본 정보:
- 갤럭시 S25는 삼성전자의 최신 스마트폰입니다.
- 강력한 성능과 혁신적인 카메라 시스템을 갖추고 있습니다.
- AI 기능이 향상되어 사용자 경험을 개선했습니다.
      `;
    }
  } catch (error: any) {
    console.error("검색 중 오류 발생:", error);
    return `검색 중 오류가 발생했습니다: ${error.message}`;
  }
}

// 게스트 사용자 생성 또는 가져오기
async function getOrCreateGuestUser() {
  try {
    // 게스트 이메일 생성
    const guestEmail = `guest_${generateUUID()}@example.com`;
    
    // 사용자 저장
    const { data: user, error } = await client
      .from('users')
      .insert([{ email: guestEmail }])
      .select('id')
      .single();
    
    if (error) {
      // 오류 발생 시 고정 게스트 ID 반환 (임시 방편)
      console.error('게스트 사용자 생성 오류:', error);
      return "00000000-0000-0000-0000-000000000000";
    }
    
    return user.id;
  } catch (error) {
    console.error('게스트 사용자 생성 오류:', error);
    // 항상 유효한 UUID 반환
    return "00000000-0000-0000-0000-000000000000";
  }
}

// 채팅 저장
async function saveChat(userId: string, title: string) {
  try {
    const { data: chat, error } = await client
      .from('chats')
      .insert([{
        user_id: userId,
        title: title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        visibility: 'private'
      }])
      .select('id')
      .single();
    
    if (error) {
      console.error('채팅 저장 오류:', error);
      return null;
    }
    
    return chat.id;
  } catch (error) {
    console.error('채팅 저장 오류:', error);
    return null;
  }
}

// 메시지 저장
async function saveMessage(chatId: string, role: string, content: string) {
  try {
    const { data: message, error } = await client
      .from('messages')
      .insert([{
        chat_id: chatId,
        role: role,
        content: content,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();
    
    if (error) {
      console.error('메시지 저장 오류:', error);
      return null;
    }
    
    return message.id;
  } catch (error) {
    console.error('메시지 저장 오류:', error);
    return null;
  }
}

// 채팅 가져오기
async function getChatById(chatId: string) {
  try {
    const { data, error } = await client
      .from('chats')
      .select('*')
      .eq('id', chatId);
    
    if (error) {
      console.error('채팅 가져오기 오류:', error);
      return null;
    }
    
    // 결과가 없거나 여러 개인 경우 처리
    if (!data || data.length === 0) {
      console.log(`채팅 ID ${chatId}에 해당하는 결과가 없습니다.`);
      return null;
    }
    
    // 첫 번째 결과 반환
    return data[0];
  } catch (error) {
    console.error('채팅 가져오기 오류:', error);
    return null;
  }
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    console.log('받은 요청 본문:', JSON.stringify(json)); // 디버깅 로그 추가
    
    // 더 유연한 요청 구조 처리
    let query = '';
    let userMessage;
    
    // 다양한 요청 형식 처리
    if (json.messages && Array.isArray(json.messages) && json.messages.length > 0) {
      // 메시지 배열이 있는 경우 마지막 메시지 사용
      userMessage = json.messages[json.messages.length - 1];
      query = typeof userMessage.content === 'string' ? userMessage.content : '';
    } else if (json.message && typeof json.message === 'object') {
      // message 객체가 직접 전달된 경우
      userMessage = json.message;
      query = typeof userMessage.content === 'string' ? userMessage.content : '';
    } else if (json.content && typeof json.content === 'string') {
      // content가 직접 전달된 경우
      query = json.content;
      userMessage = { role: 'user', content: query };
    } else if (typeof json.query === 'string') {
      // query 필드가 전달된 경우
      query = json.query;
      userMessage = { role: 'user', content: query };
    }
    
    // 최소한의 유효성 검사
    if (!query) {
      console.error('유효하지 않은 메시지 내용:', json);
      return new Response('유효한 메시지 내용이 필요합니다.', { status: 400 });
    }
    
    // 채팅 ID 처리 - UUID 형식 확인 및 변환
    let chatId = json.id || json.chatId;
    
    // UUID 형식 검증 함수
    const isValidUUID = (uuid: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    };
    
    // UUID가 아닌 경우 새 UUID 생성
    if (chatId && !isValidUUID(chatId)) {
      console.log(`전달된 ID ${chatId}는, UUID 형식이 아닙니다. 새 UUID를 생성합니다.`);
      chatId = generateUUID();
    }
    
    // 채팅 히스토리를 위한 데이터 저장 (비동기로 처리)
    let userId: string | null = null;
    let newChatId: string | null = null;
    
    try {
      // 게스트 사용자 가져오기 또는 생성
      userId = await getOrCreateGuestUser();
      
      if (userId) {
        if (chatId) {
          // 기존 채팅 ID가 제공된 경우, 해당 채팅이 존재하는지 확인
          const existingChat = await getChatById(chatId);
          if (existingChat) {
            newChatId = chatId;
          } else {
            // 채팅이 존재하지 않는 경우 새로 생성
            newChatId = await saveChat(userId, `${query.substring(0, 50)}...`);
          }
        } else {
          // 새 채팅 생성
          newChatId = await saveChat(userId, `${query.substring(0, 50)}...`);
        }
        
        if (newChatId) {
          // 사용자 메시지 저장
          const messageId = await saveMessage(newChatId, 'user', query);
          if (!messageId) {
            console.warn('사용자 메시지 저장 실패');
          }
        }
      }
    } catch (dbError) {
      console.error('DB 저장 오류:', dbError);
      // DB 저장 오류가 있어도 챗봇 응답은 계속 진행
    }
    
    // 갤럭시 챗봇 검색 로직 적용
    const searchContext = await searchDocuments(query);
    
    // 시스템 프롬프트 설정
    const systemPromptText = `
    당신은 삼성 갤럭시 S25의 친절하고 도움이 되는 가상 도우미입니다. 
    사용자의 질문에 대해 상세하고 유용한 정보를 제공하며, 필요한 경우 단계별 안내를 해주세요.
    기술적인 정보뿐만 아니라 실제 사용자가 이해하기 쉽고 도움이 되는 조언도 함께 제공해 주세요.
    친근하고 대화하듯 답변하되, 정확한 정보를 제공하는 것이 가장 중요합니다.

    참고할 정보는 다음과 같습니다:
    ${searchContext}
    
    === 중요: 이미지 URL 포함 방법 ===
    이미지가 필요한 경우 반드시 아래 형식을 정확히 따라주세요:
    
    [이미지 1]
    https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/파일명.jpg
    
    이미지 형식 규칙:
    1. [이미지 숫자] 형식의 태그를 반드시 사용하세요 (공백 및 숫자 형식 유지)
    2. 다음 줄에 URL을 정확히 입력하세요 (줄바꿈 필수)
    3. URL은 https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/ 형식이어야 합니다
    4. URL에 이중 슬래시('//')가 아닌 단일 슬래시('/')를 사용해야 합니다
    5. URL 앞에 @ 문자를 붙이지 마세요
    6. URL 끝에 ? 문자를 붙이지 마세요
    
    사용할 수 있는 이미지 URL 형식의 예:
    
    [이미지 1]
    https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/galaxy_s25_chart_p43_mid_0fb137a8.jpg

    *** 매우 중요: 모든 응답에 반드시 위 형식대로 이미지를 포함해야 합니다. 이미지가 없으면 사용자는 시각적 참조를 할 수 없습니다. ***
    `;
    
    // 디버그: 이미지 URL 관련 패턴을 확인하는 함수
    const checkImagePatterns = (response: string) => {
      // 이미지 패턴 확인
      const hasImagePattern = response.includes('[이미지');
      const hasSupabaseUrl = response.includes('ywvoksfszaelkceectaa.supabase.co');
      
      console.log('응답에 [이미지] 패턴 포함:', hasImagePattern);
      console.log('응답에 Supabase URL 포함:', hasSupabaseUrl);
      
      if (hasImagePattern) {
        const matches = response.match(/\[이미지[^\n]*\n[^\n]+/g);
        if (matches) {
          console.log('발견된 이미지 패턴 수:', matches.length);
          console.log('발견된 이미지 패턴:', matches);
          
          // 각 이미지 패턴 분석
          matches.forEach((match, index) => {
            const lines = match.split('\n');
            if (lines.length >= 2) {
              console.log(`이미지 ${index + 1} 패턴:`, lines[0]);
              console.log(`이미지 ${index + 1} URL:`, lines[1]);
              
              // URL 형식 검사
              const urlValid = lines[1].match(/^https?:\/\//i);
              console.log(`이미지 ${index + 1} URL 형식 유효:`, !!urlValid);
            }
          });
        } else {
          console.log('이미지 패턴은 있지만 매치되는 형식 없음');
        }
      }
      
      // Supabase URL 형식 검사
      if (hasSupabaseUrl) {
        const supabaseUrls = response.match(/https?:\/\/[^\s\n]*?ywvoksfszaelkceectaa\.supabase\.co[^\s\n]*/g);
        if (supabaseUrls) {
          console.log('발견된 Supabase URL 수:', supabaseUrls.length);
          console.log('발견된 Supabase URL:', supabaseUrls);
        }
      }
    };
    
    // 스트리밍 응답 생성
    const response = createDataStreamResponse({
      execute: async (dataStream) => {
        // AI에 전달할 메시지 구성 
        const aiMessages = Array.isArray(json.messages) && json.messages.length > 0 
          ? json.messages 
          : [{ role: 'user', content: query }];
          
        // 디버그 모드 설정 - 항상 활성화
        const isDebugMode = true; // json.debug_mode === true; 대신 항상 true로 고정
        console.log('디버그 모드 활성화 여부:', isDebugMode);
        
        // streamText 함수 옵션 수정
        const result = streamText({
          model: myProvider.languageModel('chat-model'),
          system: systemPromptText,
          messages: aiMessages,
          // 청크 처리 방식 개선 - 이미지 URL이 분리되지 않도록 사용자 정의 패턴 사용
          experimental_transform: smoothStream({
            // 이미지 패턴 [이미지 숫자]와 URL이 분리되지 않도록 특별한 정규식 패턴 사용
            chunking: /(\[이미지\s*\d+\][^\n]*\n(?:https?:\/\/[^\s\n]+))|(\S+\s+)/,
            delayInMs: 0  // 딜레이 없이 빠르게 전송
          }),
          experimental_generateMessageId: generateUUID,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          }
        });

        // 스트림 처리 시작 로그
        console.log('스트림 응답 시작됨 - 이미지 URL 포함 여부 확인');
        
        // 스트림 소비 및 병합
        result.consumeStream();
        await result.mergeIntoDataStream(dataStream);
        
        // 응답 로깅
        console.log('응답 데이터 스트림 병합됨 - 이미지 URL 전송 확인 필요');
        
        // 스트리밍 응답 후에 별도로 직접 API 호출로 응답 확인 (이미지 URL 처리용)
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPromptText },
              { role: "user", content: query }
            ],
          });
          
          const fullContent = completion.choices[0]?.message?.content || '';
          console.log('직접 API 호출 응답 길이:', fullContent.length);
          
          // 응답 데이터 구조 전체 로깅
          console.log('API 응답 데이터 전체:', JSON.stringify(completion.choices[0]?.message?.content || ''));
          
          // 이미지 URL 처리
          const images: Array<{url: string, page: string, relevance_score: number}> = [];
          const content = fullContent;
          
          // 이미지 패턴이 있는지 확인
          if (content.includes('[이미지')) {
            console.log('응답에서 이미지 패턴 발견, 추출 시도');
            
            // 이미지 패턴 추출 (개선된 패턴)
            // 1. 기본 패턴: [이미지 숫자] 다음 줄에 URL
            const pattern1 = /\[이미지\s*(\d+)\][^\n]*\n(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
            
            // 2. @ 문자가 붙은 URL 패턴
            const pattern2 = /\[이미지\s*(\d+)\][^\n]*\n@(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
            
            // 3. 이미지 패턴과 URL이 같은 줄에 있는 경우
            const pattern3 = /\[이미지\s*(\d+)\][^\n]*\s+(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gim;
            
            // 4. 이미지 패턴과 URL 사이에 공백이나 다른 텍스트가 있는 경우 (최대 200자까지)
            const pattern4 = /\[이미지\s*(\d+)\][^\n]{0,200}(?:\n|.){0,200}(https?:\/\/[^\s\n]+?)(?:\?.*?)?(?:\s|$)/gims;
            
            console.log('응답 내용에서 패턴 검색 시작...');
            console.log('전체 응답 내용 길이:', content.length);
            
            // 각 패턴을 시도하고 로깅
            const allMatches = [];
            
            // 패턴 1 시도
            let match;
            while ((match = pattern1.exec(content)) !== null) {
              const imageNum = match[1];
              let imageUrl = match[2].trim();
              
              // URL이 ?로 끝나면 제거
              if (imageUrl.endsWith('?')) {
                imageUrl = imageUrl.slice(0, -1);
              }
              
              // URL이 @로 시작하면 제거
              if (imageUrl.startsWith('@')) {
                imageUrl = imageUrl.substring(1);
              }
              
              console.log(`이미지 패턴1 매치: [${imageNum}] ${imageUrl}`);
              allMatches.push({ pattern: 'pattern1', imageNum, imageUrl });
              
              // 중복 방지
              if (!images.some(img => img.url === imageUrl)) {
                images.push({
                  url: imageUrl,
                  page: imageNum,
                  relevance_score: 0.8
                });
              }
            }
            
            // 패턴 2 시도 (@ 문자 처리)
            while ((match = pattern2.exec(content)) !== null) {
              const imageNum = match[1];
              let imageUrl = match[2].trim();
              
              // URL이 ?로 끝나면 제거
              if (imageUrl.endsWith('?')) {
                imageUrl = imageUrl.slice(0, -1);
              }
              
              // URL에서 @ 기호 제거
              if (imageUrl.startsWith('@')) {
                imageUrl = imageUrl.substring(1);
              }
              
              console.log(`이미지 패턴2 매치(@ 포함): [${imageNum}] ${imageUrl}`);
              allMatches.push({ pattern: 'pattern2', imageNum, imageUrl });
              
              // 중복 방지
              if (!images.some(img => img.url === imageUrl)) {
                images.push({
                  url: imageUrl,
                  page: imageNum,
                  relevance_score: 0.9
                });
              }
            }
            
            // 패턴 3 시도 (같은 줄에 있는 경우)
            while ((match = pattern3.exec(content)) !== null) {
              const imageNum = match[1];
              let imageUrl = match[2].trim();
              
              // URL이 ?로 끝나면 제거
              if (imageUrl.endsWith('?')) {
                imageUrl = imageUrl.slice(0, -1);
              }
              
              console.log(`이미지 패턴3 매치(한 줄): [${imageNum}] ${imageUrl}`);
              allMatches.push({ pattern: 'pattern3', imageNum, imageUrl });
              
              // 중복 방지
              if (!images.some(img => img.url === imageUrl)) {
                images.push({
                  url: imageUrl,
                  page: imageNum,
                  relevance_score: 0.7
                });
              }
            }
            
            // 패턴 4 시도 (여러 줄에 걸친 경우)
            while ((match = pattern4.exec(content)) !== null) {
              const imageNum = match[1];
              let imageUrl = match[2]?.trim();
              
              if (!imageUrl) continue;
              
              // URL이 ?로 끝나면 제거
              if (imageUrl.endsWith('?')) {
                imageUrl = imageUrl.slice(0, -1);
              }
              
              console.log(`이미지 패턴4 매치(여러 줄): [${imageNum}] ${imageUrl}`);
              allMatches.push({ pattern: 'pattern4', imageNum, imageUrl });
              
              // 중복 방지
              if (!images.some(img => img.url === imageUrl)) {
                images.push({
                  url: imageUrl,
                  page: imageNum,
                  relevance_score: 0.6
                });
              }
            }
            
            // 이미지가 추출되면 메타데이터를 설정
            if (images.length > 0) {
              console.log('추출된 이미지:', JSON.stringify(images));
              console.log('패턴별 매치 결과:', allMatches);
              
              // 스트림의 마지막 메시지 ID를 가져와서 이미지 메타데이터 업데이트
              // 참고: 이 부분은 ai 라이브러리 구현에 따라 작동하지 않을 수 있음
              // 그러나 타입 에러 해결을 위해 필요함
              console.log('추출된 이미지 메타데이터 설정 시도');
            } else {
              console.log('이미지 패턴은 발견되었으나 추출 실패');
              
              // 백업 방법: Supabase URL 직접 추출
              const supabasePattern = /https?:\/\/ywvoksfszaelkceectaa\.supabase\.co\/storage\/v1\/object\/public\/images\/[^\s\n?]+(?:\?[^\s\n]*)?/gi;
              const supabaseMatches = content.match(supabasePattern);
              
              if (supabaseMatches) {
                console.log('Supabase URL 직접 추출:', supabaseMatches);
                
                supabaseMatches.forEach((url, idx) => {
                  const trimmedUrl = url.trim();
                  const finalUrl = trimmedUrl.endsWith('?') ? trimmedUrl.slice(0, -1) : trimmedUrl;
                  
                  if (!images.some(img => img.url === finalUrl)) {
                    images.push({
                      url: finalUrl,
                      page: String(idx + 1),
                      relevance_score: 0.5
                    });
                  }
                });
                
                if (images.length > 0) {
                  console.log('백업 방법으로 추출된 이미지:', JSON.stringify(images));
                }
              }
            }
          } else {
            // 이미지 패턴이 없는 경우 자동으로 이미지 추가
            console.log('응답에 이미지 패턴이 없음 - 자동 이미지 삽입 시도');
            
            // 질문 및 응답에서 키워드 추출
            const combinedText = query + " " + content;
            const keywords = [
              { word: 'camera', image: 'galaxy_s25_camera.jpg', score: 0.8 },
              { word: '카메라', image: 'galaxy_s25_camera.jpg', score: 0.8 },
              { word: 'screen', image: 'galaxy_s25_screen.jpg', score: 0.8 },
              { word: '화면', image: 'galaxy_s25_screen.jpg', score: 0.8 },
              { word: 'interface', image: 'galaxy_s25_interface.jpg', score: 0.7 },
              { word: '인터페이스', image: 'galaxy_s25_interface.jpg', score: 0.7 },
              { word: 'settings', image: 'galaxy_s25_settings.jpg', score: 0.8 },
              { word: '설정', image: 'galaxy_s25_settings.jpg', score: 0.8 },
              { word: 'battery', image: 'galaxy_s25_battery.jpg', score: 0.7 },
              { word: '배터리', image: 'galaxy_s25_battery.jpg', score: 0.7 },
              { word: 'S pen', image: 'galaxy_s25_spen.jpg', score: 0.9 },
              { word: 'S펜', image: 'galaxy_s25_spen.jpg', score: 0.9 },
              { word: 'home', image: 'galaxy_s25_home.jpg', score: 0.6 },
              { word: '홈', image: 'galaxy_s25_home.jpg', score: 0.6 },
              { word: '메인', image: 'galaxy_s25_home.jpg', score: 0.6 }
            ];
            
            // 키워드 매칭
            let matchedKeywords = [];
            for (const keyword of keywords) {
              if (combinedText.toLowerCase().includes(keyword.word.toLowerCase())) {
                matchedKeywords.push(keyword);
              }
            }
            
            // 매칭된 키워드가 있으면 이미지 URL 생성
            if (matchedKeywords.length > 0) {
              console.log('키워드 매칭 성공, 매칭된 키워드:', matchedKeywords.map(k => k.word).join(', '));
              
              // 가장 연관성 높은 키워드를 기준으로 정렬
              matchedKeywords.sort((a, b) => b.score - a.score);
              
              // 최대 2개의 이미지만 추가
              const topKeywords = matchedKeywords.slice(0, 2);
              
              topKeywords.forEach((keyword, idx) => {
                const imageUrl = `https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/${keyword.image}`;
                
                images.push({
                  url: imageUrl,
                  page: String(idx + 1),
                  relevance_score: keyword.score
                });
              });
              
              console.log('자동 추가된 이미지:', JSON.stringify(images));
              
              // 이미지 정보를 응답에 저장하는 로직 필요 - 스트리밍 응답에는 추가하기 어려움
              // 대신 client-side에서 수동으로 이미지를 표시하도록 설정
            } else {
              // 매칭된 키워드가 없으면 기본 이미지 추가
              console.log('매칭된 키워드 없음, 기본 이미지 추가');
              
              const defaultImage = 'https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/galaxy_s25_interface.jpg';
              images.push({
                url: defaultImage,
                page: '1',
                relevance_score: 0.5
              });
            }
          }
          
          // 이미지 데이터를 클라이언트에서 사용할 수 있도록 저장
          if (images.length > 0 && newChatId) {
            try {
              // 응답 메시지에 이미지 정보 추가 
              // 이 로직은 채팅 메시지 저장 시 이미지 정보도 함께 저장
              const messageMetadata = {
                images: images,
                chat_id: newChatId,
                content: fullContent
              };
              
              // 메시지 저장 API 호출
              const metadataResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chatId: newChatId,
                  content: fullContent,
                  metadata: {
                    images: images
                  }
                }),
              });
              
              if (!metadataResponse.ok) {
                console.error('이미지 메타데이터 저장 실패:', await metadataResponse.text());
              } else {
                console.log('이미지 메타데이터 저장 성공');
                
                // 이미지 정보를 응답 헤더에도 추가
                try {
                  // 각 이미지 URL을 Base64로 인코딩하여 헤더에 추가
                  // 이미지가 많을 경우 첫 번째 이미지만 헤더에 추가
                  if (images.length > 0) {
                    const firstImageUrl = images[0].url;
                    const encodedUrl = Buffer.from(firstImageUrl).toString('base64');
                    response.headers.set('X-Image-Data', encodedUrl);
                    response.headers.set('X-Image-Count', String(images.length));
                  }
                } catch (headerError) {
                  console.error('이미지 헤더 추가 오류:', headerError);
                }
              }
            } catch (metadataError) {
              console.error('이미지 메타데이터 저장 중 오류:', metadataError);
            }
          }
          
          // 스트리밍 응답이 완료된 후 이미지 정보를 클라이언트에 직접 전달
          // 이미지 추가 메시지 푸시
          try {
            dataStream.writeData({
              type: 'images',
              content: images
            });
            console.log('이미지 데이터 스트림에 직접 추가됨:', images.length);
          } catch (streamError) {
            console.error('이미지 스트림 추가 오류:', streamError);
          }
        } catch (error) {
          console.error('직접 API 호출 오류:', error);
        }
      },
      onError: (error) => {
        console.error('데이터 스트림 오류:', error);
        return '죄송합니다. 응답 처리 중 오류가 발생했습니다.';
      },
    });

    // 채팅 ID를 응답 헤더에 포함
    if (newChatId) {
      response.headers.set('X-Chat-ID', newChatId);
    }

    return response;
  } catch (error) {
    console.error("오류:", error);
    return new Response('요청 처리 중 오류가 발생했습니다.', {
      status: 500,
    });
  }
}

// 채팅 목록 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '10');
    
    // 최근 채팅 목록 조회
    const { data: chats, error } = await client
      .from('chats')
      .select('id, title, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('채팅 목록 조회 오류:', error);
      return new Response('채팅 목록 조회 중 오류가 발생했습니다.', { status: 500 });
    }
    
    return Response.json(chats);
  } catch (error) {
    console.error('채팅 목록 조회 오류:', error);
    return new Response('채팅 목록 조회 중 오류가 발생했습니다.', { status: 500 });
  }
}

// DELETE 함수는 우선 인증 로직을 제거하고 단순화
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('찾을 수 없는 채팅입니다.', { status: 404 });
  }

  try {
    // 채팅 삭제
    const { error } = await client
      .from('chats')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('채팅 삭제 오류:', error);
      return new Response('채팅 삭제 중 오류가 발생했습니다.', { status: 500 });
    }
    
    return Response.json({ deleted: true }, { status: 200 });
  } catch (error) {
    console.error('채팅 삭제 오류:', error);
    return new Response('채팅 삭제 중 오류가 발생했습니다.', { status: 500 });
  }
}

// AI 응답 메시지 저장을 위한 추가 API 엔드포인트
export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const { chatId, content, metadata } = json;
    
    if (!chatId || !content) {
      return new Response('채팅 ID와 메시지 내용은 필수입니다.', { status: 400 });
    }
    
    // 기본 메시지 데이터
    const messageData: any = {
      chat_id: chatId,
      role: 'assistant',
      content: content,
      created_at: new Date().toISOString()
    };
    
    // 메타데이터가 있으면 추가
    if (metadata) {
      if (metadata.images) {
        messageData.metadata = { images: metadata.images };
      }
    }
    
    // 메시지 저장 (메타데이터 포함)
    const { data: message, error } = await client
      .from('messages')
      .insert([messageData])
      .select('id')
      .single();
    
    if (error) {
      console.error('메시지 저장 오류:', error);
      return new Response('메시지 저장 중 오류가 발생했습니다.', { status: 500 });
    }
    
    // 성공 응답에 이미지 정보도 포함
    return Response.json({ 
      success: true, 
      messageId: message.id,
      hasImages: !!(metadata && metadata.images && metadata.images.length > 0),
      imageCount: metadata?.images?.length || 0
    });
  } catch (error) {
    console.error('AI 응답 저장 오류:', error);
    return new Response('요청 처리 중 오류가 발생했습니다.', { status: 500 });
  }
}