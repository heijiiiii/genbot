# 갤럭시 S25 챗봇

갤럭시 S25 매뉴얼에 대한 질문과 답변을 제공하는 챗봇 애플리케이션입니다.

## 구성 요소

1. **백엔드 (Python FastAPI)**
   - `app.py`: FastAPI 기반 API 서버
   - `galaxy_chatbot.py`: LangGraph 기반 챗봇 로직

2. **프론트엔드 (Next.js)**
   - `galaxy-web-ui/`: Next.js 웹 애플리케이션

## 환경 변수 설정

프로젝트를 실행하기 전에 다음 환경 변수를 설정해야 합니다:

### 백엔드 (`.env` 파일 생성)

```
# OpenAI API 키
OPENAI_API_KEY=your_openai_api_key_here

# Cohere API 키
COHERE_API_KEY=your_cohere_api_key_here

# Supabase 설정
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 프론트엔드 (`galaxy-web-ui/.env.local` 파일 생성)

```
# API URL (배포 시 변경)
NEXT_PUBLIC_API_URL=http://localhost:8000

# OpenAI API 키
OPENAI_API_KEY=your_openai_api_key_here

# Cohere API 키
COHERE_API_KEY=your_cohere_api_key_here

# Supabase 설정
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

## 설치 및 실행

### 백엔드

```bash
# 필요한 패키지 설치
pip install -r requirements.txt

# 서버 실행
python app.py
```

### 프론트엔드

```bash
# galaxy-web-ui 디렉토리로 이동
cd galaxy-web-ui

# 필요한 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

## 배포

배포 방법에 대한 자세한 내용은 `DEPLOYMENT.md` 파일을 참조하세요.