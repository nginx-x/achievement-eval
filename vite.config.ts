import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import packageJson from './package.json';

function deploymentBase(): string {
  try {
    return new URL(packageJson.homepage).pathname.replace(/\/*$/, '/');
  } catch {
    return '/';
  }
}

function renameSingleHtml(): Plugin {
  return {
    name: 'rename-single-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html) return;
      delete bundle['index.html'];
      html.fileName = 'achievement-eval.html';
      bundle[html.fileName] = html;
    },
  };
}

// core 는 UI 의존 0 인 순수 로직. path alias 로 계층 경계를 명확히.
// `--mode single` : 모든 JS/CSS/폰트를 index.html 하나에 인라인 → file:// 더블클릭 가능(오프라인 배포용).
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: single ? './' : mode === 'production' ? deploymentBase() : '/',
    plugins: [react(), ...(single ? [viteSingleFile(), renameSingleHtml()] : [])],
    resolve: {
      alias: {
        '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
        '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
        '@io': fileURLToPath(new URL('./src/io', import.meta.url)),
      },
    },
    build: {
      // minify 는 기본(esbuild). 소스맵은 배포 시 비공개 유지 위해 끔.
      sourcemap: false,
      target: 'es2022',
      outDir: single ? 'dist-single' : 'dist',
      // single 모드: 폰트(woff2)까지 base64 로 인라인
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      // 탐색 중 만든 임시 특성화 테스트는 파일을 보존하되 정식 회귀에서는 제외한다.
      exclude: ['src/**/*.tmp*.test.ts'],
    },
  };
});
