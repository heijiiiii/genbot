import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_cohere import CohereEmbeddings
from langchain_openai import ChatOpenAI
from langchain_community.vectorstores.supabase import SupabaseVectorStore

# 환경 변수 로드
load_dotenv()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not OPENAI_API_KEY:
    OPENAI_API_KEY = input("OpenAI API 키를 입력하세요: ")
    os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

if not COHERE_API_KEY:
    COHERE_API_KEY = input("Cohere API 키를 입력하세요: ")
    os.environ["COHERE_API_KEY"] = COHERE_API_KEY

if not SUPABASE_URL:
    SUPABASE_URL = input("Supabase URL을 입력하세요: ")
    os.environ["SUPABASE_URL"] = SUPABASE_URL

if not SUPABASE_SERVICE_ROLE_KEY:
    SUPABASE_SERVICE_ROLE_KEY = input("Supabase Service Role Key를 입력하세요: ")
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = SUPABASE_SERVICE_ROLE_KEY

# Supabase 클라이언트 생성
try:
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("✅ Supabase 연결 성공!")
except Exception as e:
    print(f"❌ Supabase 연결 실패: {str(e)}")
    exit(1)

# Cohere 임베딩 설정
try:
    cohere_embeddings = CohereEmbeddings(
        model="embed-v4.0",
        cohere_api_key=COHERE_API_KEY
    )
    print("✅ Cohere 임베딩 모델 설정 성공!")
except Exception as e:
    print(f"❌ Cohere 임베딩 모델 설정 실패: {str(e)}")
    exit(1)

# Supabase 벡터 스토어 설정
try:
    text_vectorstore = SupabaseVectorStore(
        client=client,
        embedding=cohere_embeddings,
        table_name="text_embeddings",
        query_name="match_text_embeddings"
    )
    print("✅ Supabase 벡터 스토어 설정 성공!")
except Exception as e:
    print(f"❌ Supabase 벡터 스토어 설정 실패: {str(e)}")
    exit(1)

# OpenAI LLM 설정
try:
    llm = ChatOpenAI(
        model_name="gpt-4o",
        temperature=0.2,
        api_key=OPENAI_API_KEY
    )
    print("✅ OpenAI LLM 설정 성공!")
except Exception as e:
    print(f"❌ OpenAI LLM 설정 실패: {str(e)}")
    exit(1)

# 간단한 검색 테스트 함수
def test_search(query):
    print(f"\n🔍 검색 쿼리: '{query}'")
    
    try:
        # 벡터 검색 수행
        docs = text_vectorstore.similarity_search(query, k=3)
        
        if not docs:
            print("❌ 검색 결과가 없습니다.")
            return
        
        print(f"✅ {len(docs)}개의 검색 결과를 찾았습니다!\n")
        
        # 검색 결과 출력
        for i, doc in enumerate(docs):
            print(f"[결과 {i+1}]")
            print(f"내용: {doc.page_content[:200]}{'...' if len(doc.page_content) > 200 else ''}")
            print(f"메타데이터: 페이지={doc.metadata.get('page', '없음')}, 카테고리={doc.metadata.get('category', '없음')}")
            print()
        
        # LLM으로 답변 생성
        context = "\n".join([doc.page_content for doc in docs])
        prompt = f"""
        당신은 제네시스 차량 매뉴얼에 특화된 전문가입니다.
        아래 정보를 바탕으로 질문에 상세하게 답변해 주세요:
        
        참고 정보:
        {context}
        
        질문: {query}
        """
        
        response = llm.invoke(prompt)
        print("\n💬 LLM 답변:")
        print(response.content)
        
    except Exception as e:
        print(f"❌ 검색 중 오류 발생: {str(e)}")

# 테스트 실행
print("\n===== 제네시스 매뉴얼 검색 테스트 =====")
print("(종료하려면 'q' 또는 'quit'을 입력하세요)")

while True:
    query = input("\n검색할 내용을 입력하세요: ")
    if query.lower() in ['q', 'quit', '종료']:
        print("테스트를 종료합니다. 감사합니다!")
        break
    
    test_search(query) 