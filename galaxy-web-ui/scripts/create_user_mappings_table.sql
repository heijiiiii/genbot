-- 사용자 ID 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS user_mappings (
  id SERIAL PRIMARY KEY,
  next_auth_id UUID NOT NULL UNIQUE,
  supabase_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  email TEXT
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_user_mappings_next_auth_id ON user_mappings(next_auth_id);
CREATE INDEX IF NOT EXISTS idx_user_mappings_supabase_id ON user_mappings(supabase_id);

-- 기본 테스트 데이터 추가
INSERT INTO user_mappings (next_auth_id, supabase_id, created_at, email)
VALUES 
  ('58e0ea15-3c59-46aa-bd69-3751bb0a0b4b', '0f705e4c-9270-4dd4-8b55-5f46ec04c196', NOW(), 'test@example.com')
ON CONFLICT (next_auth_id) DO NOTHING;

-- 사용 방법 설명
-- 1. Supabase Studio에서 SQL 편집기로 이 파일을 실행하거나
-- 2. psql 명령어로 실행: psql -U <사용자명> -d <데이터베이스명> -a -f create_user_mappings_table.sql 