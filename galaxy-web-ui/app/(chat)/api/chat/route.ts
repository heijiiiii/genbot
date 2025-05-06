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
import { getProxyImageUrl, extractImagesFromText, type ImageData } from '@/lib/ai';

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

// 이미지 캐시 (성능 최적화)
let cachedImages: string[] = [];
let lastCacheTime = 0;

// Supabase에서 이미지 목록 가져오기
async function getAvailableImages() {
  try {
    // 캐시가 5분 이내에 갱신됐으면 캐시 사용
    const now = Date.now();
    if (cachedImages.length > 0 && now - lastCacheTime < 5 * 60 * 1000) {
      return cachedImages;
    }
    
    // Supabase Storage에서 이미지 목록 가져오기
    const { data, error } = await client
      .storage
      .from('images')
      .list();
    
    if (error) {
      console.error('이미지 목록 가져오기 오류:', error);
      return [];
    }
    
    // 이미지 파일만 필터링
    const imageFiles = data
      .filter(item => !item.id.endsWith('/') && 
             (item.name.endsWith('.jpg') || 
              item.name.endsWith('.jpeg') || 
              item.name.endsWith('.png')))
      .map(item => item.name);
    
    console.log(`Supabase에서 ${imageFiles.length}개 이미지 목록 로드됨`);
    
    // 캐시 업데이트
    cachedImages = imageFiles;
    lastCacheTime = now;
    
    return imageFiles;
  } catch (error) {
    console.error('이미지 목록 가져오기 중 오류:', error);
    return [];
  }
}

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
    https://ywvoksfszaelkceectaa.supabase.co/storage/v1/object/public/images/galaxy_s25_[type]_p[page]_[position]_[hash].jpg

    여기서:
    - [type]: 이미지 유형 (예: chart, figure, diagram, screen 등)
    - [page]: 페이지 번호 (숫자)
    - [position]: 이미지 위치 (top, mid, bot)
    - [hash]: 고유 식별자 (16진수 해시)

    *** 매우 중요: 모든 응답에 반드시 위 형식대로 이미지를 포함해야 합니다. 이미지가 없으면 사용자는 시각적 참조를 할 수 없습니다. ***
    `;
    
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
          // 청크 처리 방식 개선 - 이미지 패턴이 분리되지 않도록 큰 단위로 전송
          experimental_transform: smoothStream({
            chunking: /\n\n|\n(?=\[이미지)/,  // 빈 줄 또는 이미지 패턴 시작 부분을 기준으로 분할
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
          
          // 이미지 패턴 확인
          const hasImagePattern = fullContent.includes('[이미지');
          const hasSupabaseUrl = fullContent.includes('ywvoksfszaelkceectaa.supabase.co');
          
          console.log('응답에 이미지 패턴 포함:', hasImagePattern);
          console.log('응답에 Supabase URL 포함:', hasSupabaseUrl);
          
          // 이미지 메타데이터를 스트림으로 전송하지 않고 프론트엔드에서 처리하도록 함
          // 프론트엔드에서는 텍스트에서 이미지 패턴을 추출하여 표시
          
          // 이미지가 있는 경우 로깅만 수행
          if (hasImagePattern || hasSupabaseUrl) {
            console.log('응답에 이미지 패턴이 있음 - 프론트엔드에서 처리 예정');
            
            try {
              const images = extractImagesFromText(fullContent);
              if (images && images.length > 0) {
                console.log('이미지 추출 성공 (백엔드):', images.length);
              }
            } catch (error) {
              console.error('이미지 추출 중 오류 (백엔드):', error);
            }
          }
          
          // 메시지 저장은 이미지 없이 텍스트만 저장
          if (newChatId) {
            try {
              // 응답 메시지 저장
              const messageResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chatId: newChatId,
                  content: fullContent
                }),
              });
              
              if (!messageResponse.ok) {
                console.error('메시지 저장 실패:', await messageResponse.text());
              } else {
                console.log('메시지 저장 성공');
              }
            } catch (saveError) {
              console.error('메시지 저장 중 오류:', saveError);
            }
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