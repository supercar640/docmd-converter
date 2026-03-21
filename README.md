# DocMD Converter

DOCX와 Markdown 간 양방향 변환기. 모든 처리는 브라우저에서 이루어지며, 서버로 파일이 전송되지 않습니다.

**Live Demo:** [docmd-converter.vercel.app](https://docmd-converter.vercel.app)

## 주요 기능

- **DOCX → Markdown** 변환
- **Markdown → DOCX** 변환
- 드래그 앤 드롭 파일 추가
- 최대 50개 파일 배치 처리
- 단일 파일은 직접 다운로드, 복수 파일은 ZIP 다운로드
- DOCX 원본의 문단 간격을 Markdown에 정확히 반영 (빈 줄 기준 문단 구분)

## 기술 스택

- [Next.js](https://nextjs.org) (App Router)
- [mammoth](https://github.com/mwilliamson/mammoth.js) - DOCX → HTML 변환
- [Turndown](https://github.com/mixmark-io/turndown) - HTML → Markdown 변환
- [docx](https://github.com/dolanmiri/docx) - Markdown → DOCX 변환
- [JSZip](https://stuk.github.io/jszip/) - DOCX XML 파싱 및 ZIP 다운로드
- [Tailwind CSS](https://tailwindcss.com) - 스타일링

## 시작하기

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## 배포

GitHub에 푸시하면 Vercel을 통해 자동 배포됩니다.
