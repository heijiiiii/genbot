#!/bin/bash
# Railway 배포 스크립트

# 배포할 프로젝트 이름 (필요에 따라 변경)
PROJECT_NAME="galaxy-chatbot"

# 실행 권한 설정
chmod +x start.sh

# Railway CLI를 사용하여 배포
echo "Railway에 배포 시작..."
railway up \
  --service $PROJECT_NAME \
  --detach

echo "배포 완료. 서비스 상태 확인 중..."
railway status

echo "Railway 서비스 URL:"
railway domain 