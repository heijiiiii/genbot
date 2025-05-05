#!/bin/bash
# Railway 환경을 위한 메모리 최적화 시작 스크립트

# 메모리 제한 설정
export MALLOC_ARENA_MAX=2
export PYTHONMALLOC=malloc
export MALLOC_TRIM_THRESHOLD_=65536
export PYTHONDONTWRITEBYTECODE=1

# 가비지 컬렉션 최적화
export PYTHONGC="1"
export PYPY_GC_NURSERY="4M"

# PORT 환경 변수가 설정되어 있지 않으면 기본값 8000 사용
export PORT=${PORT:-8000}

# 메모리 사용량 확인 (시작 시)
echo "시작 시 메모리 사용량:"
free -m

# 애플리케이션 시작 (단일 워커, 동시성 제한)
echo "애플리케이션 시작 중... (워커: 1, 동시성: 5)"
exec uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1 --limit-concurrency 5 --timeout-keep-alive 30 