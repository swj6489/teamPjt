# LocalHub

간단한 설명
- LocalHub는 공공데이터 기반 지역 정보 커뮤니티 SPA입니다 (Vue 3 + Vite).

빠른 시작
1. 의존성 설치
```
npm install
```

2. 개발 서버 실행 (백엔드 프록시 + 프론트 동시 실행)
```
npm start
```
- 프론트엔드: http://localhost:5173/
- 백엔드(프록시): http://localhost:3001/

자주 쓰는 스크립트
- `npm run dev` : Vite 개발 서버
- `npm run server` : Express 서버 (`server/index.js`)
- `npm start` : `server`와 `dev` 동시 실행 (concurrently)
- `npm run build` : 프로덕션 빌드
- `npm run preview` : 빌드 결과 미리보기
- `npm test` : 유닛테스트 (Vitest)

프로젝트 구조(주요)
- `src/` : Vue 소스
- `server/` : Express 프록시 서버
- `docs/data/` : JSON 데이터 (예: [pois.json](docs/data/pois.json))
- `docs/PHASES/` : Phase별 요구사항 문서

환경 변수
- `.env` 파일을 사용합니다 (프로젝트 루트).
- `dotenv`가 포함되어 있어 `.env`를 로드합니다.

의존성 및 Optional
- 주요: `vue`, `vue-router`, `express`, `concurrently`, `vite`
- Optional: `leaflet`, `leaflet.markercluster` (지도 기능)

알려진 이슈
- 개발 콘솔에 `poiTop` 관련 Vue 경고가 보일 수 있습니다(렌더링 시 정의되지 않음). 기능에는 영향이 크지 않지만, 컴포넌트에서 해당 데이터 정의를 검토하세요.

기여
- 간단한 PR로 기여 환영합니다.

문의
- 작업 중 문제가 있으면 알려주세요.
