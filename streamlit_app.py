import streamlit as st
import requests
import json
from typing import List, Dict, Optional, Any
import os
import warnings

# 경고 메시지 숨기기 - 일반 Python 경고만 숨김
warnings.filterwarnings('ignore')

# 페이지 설정
st.set_page_config(
    page_title="갤럭시 S25 매뉴얼 챗봇",
    page_icon="🌌",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# API 엔드포인트 설정 - Railway 배포 URL 사용 (트레일링 슬래시 제거)
API_ENDPOINT = os.environ.get("API_ENDPOINT", "https://galaxy-rag-chatbot-production.up.railway.app")

# API 상태 확인
try:
    health_response = requests.get(f"{API_ENDPOINT}/health", timeout=10)
    if health_response.status_code == 200:
        api_status = "✅ API 서버가 정상 작동 중입니다"
    else:
        api_status = f"⚠️ API 서버 응답 코드: {health_response.status_code}"
except Exception as e:
    api_status = f"❌ API 서버 연결 오류: {str(e)}"

# 디버그 모드 설정
if "debug_mode" not in st.session_state:
    st.session_state.debug_mode = False

# UI 스타일 정의
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1E88E5;
        text-align: center;
        margin-bottom: 1rem;
    }
    .sub-header {
        font-size: 1.2rem;
        color: #424242;
        text-align: center;
        margin-bottom: 2rem;
    }
    .user-message {
        background-color: #E3F2FD;
        padding: 1rem;
        border-radius: 15px;
        margin-bottom: 1rem;
        border-bottom-right-radius: 5px;
    }
    .bot-message {
        background-color: #F5F5F5;
        padding: 1rem;
        border-radius: 15px;
        margin-bottom: 1rem;
        border-bottom-left-radius: 5px;
    }
    .image-container {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        justify-content: center;
        margin-top: 20px;
        margin-bottom: 20px;
    }
    .image-card {
        max-width: 45%;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        border-radius: 10px;
        overflow: hidden;
        margin: 10px;
    }
    .image-info {
        padding: 10px;
        background-color: #F0F0F0;
        font-size: 0.8rem;
    }
    .footer {
        text-align: center;
        margin-top: 3rem;
        color: #9E9E9E;
        font-size: 0.8rem;
    }
    .stTextInput>div>div>input {
        border-radius: 25px;
    }
    .stButton>button {
        border-radius: 25px;
        padding: 0.5rem 2rem;
    }
</style>
""", unsafe_allow_html=True)

# 헤더 표시
st.markdown('<div class="main-header">갤럭시 S25 매뉴얼 챗봇</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">갤럭시 S25에 관한 질문을 자유롭게 해주세요!</div>', unsafe_allow_html=True)

# API 상태 및 디버그 모드 (사이드바에 표시)
with st.sidebar:
    st.write("### 시스템 상태")
    st.info(api_status)
    
    st.write("### 설정")
    debug_mode = st.checkbox("디버그 모드", value=st.session_state.debug_mode)
    if debug_mode != st.session_state.debug_mode:
        st.session_state.debug_mode = debug_mode
        st.rerun()
    
    # 간단한 검색 기능 (API 테스트용)
    st.write("### 검색 테스트")
    search_query = st.text_input("검색어", key="search_query")
    if st.button("검색"):
        try:
            with st.spinner("검색 중..."):
                search_response = requests.post(
                    f"{API_ENDPOINT}/search", 
                    json={"query": search_query, "limit": 3},
                    timeout=30
                )
                
                if search_response.status_code == 200:
                    search_data = search_response.json()
                    st.success("검색 성공!")
                    for i, result in enumerate(search_data.get("results", [])):
                        st.write(f"**결과 {i+1}**")
                        st.write(result.get("content", "내용 없음")[:200] + "...")
                else:
                    st.error(f"검색 오류: {search_response.status_code}")
        except Exception as e:
            st.error(f"검색 중 오류 발생: {str(e)}")

# 챗 대화 이력 초기화
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "안녕하세요! 갤럭시 S25 사용에 관한 질문이 있으신가요? 도움을 드릴게요."}
    ]
    
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

# 세션 ID 초기화 (사용자 식별용)
if "session_id" not in st.session_state:
    import uuid
    st.session_state.session_id = str(uuid.uuid4())
    
# 사용자 입력 초기화 키를 위한 변수
if "input_key" not in st.session_state:
    st.session_state.input_key = 0

# 대화 이력 표시
for message in st.session_state.messages:
    role = message["role"]
    content = message["content"]
    
    if role == "user":
        st.markdown(f'<div class="user-message">{content}</div>', unsafe_allow_html=True)
    else:
        st.markdown(f'<div class="bot-message">{content}</div>', unsafe_allow_html=True)
        
        # 이미지가 있는 경우
        if "images" in message:
            # 이미지 수에 따라 컬럼 개수 조정 (최대 2개 컬럼으로)
            num_cols = min(2, len(message["images"]))
            cols = st.columns(num_cols)
            
            for i, img in enumerate(message["images"]):
                with cols[i % num_cols]:
                    img_url = img["url"]
                    page = img.get("page", "정보 없음")
                    
                    # 이미지 크기 키우기
                    try:
                        # 너비를 300으로 키움
                        st.image(img_url, width=300, caption=f"페이지: {page}")
                    except Exception as e:
                        # 이미지 로드 실패시 오류 표시
                        st.error(f"이미지 로드 실패: {str(e)}")
            
            # 이미지 섹션 후 여백 추가
            st.write("")

# 사용자 입력 - 매번 다른 키 사용
user_input = st.text_input(
    "메시지 입력", 
    placeholder="질문을 입력하세요...", 
    key=f"user_input_{st.session_state.input_key}",
    label_visibility="collapsed"
)

# 전송 버튼 클릭 또는 Enter 키 누를 때
if user_input:
    # 사용자 메시지 추가
    st.session_state.messages.append({"role": "user", "content": user_input})
    
    # API 요청
    try:
        with st.spinner("답변 생성 중..."):
            # 디버그 정보 표시 (임시)
            if st.session_state.get("debug_mode", False):
                st.info(f"요청 URL: {API_ENDPOINT}/chat")
                # 전체 히스토리와 현재 메시지를 함께 표시
                history_display = [{
                    "role": item["role"], 
                    "content": item["content"][:50] + "..." if len(item["content"]) > 50 else item["content"]
                } for item in st.session_state.chat_history]
                st.info(f"요청 데이터: 현재 메시지: {user_input}, 이전 대화: {json.dumps(history_display, ensure_ascii=False)}")
            
            # 챗 히스토리 정리
            # 이전 대화 내용을 API에 보낼 형식으로 변환
            formatted_history = []
            for item in st.session_state.chat_history:
                if "role" in item and "content" in item:
                    formatted_history.append({
                        "role": item["role"],
                        "content": item["content"]
                    })
                elif "user" in item and "ai" in item:
                    # user와 ai 필드를 포함하는 형식인 경우
                    formatted_history.append({"role": "user", "content": item["user"]})
                    formatted_history.append({"role": "assistant", "content": item["ai"]})
            
            # 타임아웃을 더 늘려봅니다
            response = requests.post(
                f"{API_ENDPOINT}/chat", 
                json={
                    "message": user_input,
                    "history": formatted_history,
                    "session_id": st.session_state.session_id
                },
                timeout=120  # 타임아웃을 120초로 늘림
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # 봇 응답 추가
                bot_message = {
                    "role": "assistant", 
                    "content": data["answer"]
                }
                
                # 이미지가 있으면 추가
                if "images" in data and data["images"]:
                    bot_message["images"] = data["images"]
                
                st.session_state.messages.append(bot_message)
                
                # 챗 기록 업데이트 - 현재 메시지 쌍 추가
                # 사용자 메시지 추가
                st.session_state.chat_history.append({"role": "user", "content": user_input})
                # 봇 응답 추가
                st.session_state.chat_history.append({"role": "assistant", "content": data["answer"]})
                
                # 이력 제한 (최대 20개 메시지로 제한)
                if len(st.session_state.chat_history) > 20:
                    st.session_state.chat_history = st.session_state.chat_history[-20:]
                
                # 입력 키 증가시켜 새 입력 필드 생성
                st.session_state.input_key += 1
                
                # 화면 갱신 - experimental_rerun 대신 rerun 사용
                st.rerun()
            else:
                st.error(f"오류 발생: {response.status_code}")
                # 응답 내용 표시 (디버깅용)
                try:
                    st.error(f"응답 내용: {response.text[:500]}")
                except:
                    st.error("응답 내용을 확인할 수 없습니다.")
    except Exception as e:
        st.error(f"요청 처리 중 오류 발생: {str(e)}")
        # 스택 트레이스 표시 (디버깅용)
        import traceback
        st.error(f"스택 트레이스: {traceback.format_exc()}")

# 푸터
st.markdown('<div class="footer">© 2025 삼성전자 갤럭시 S25 매뉴얼 챗봇</div>', unsafe_allow_html=True) 