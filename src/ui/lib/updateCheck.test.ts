import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION, checkForUpdate, inferGitHubPagesTarget, isNewerVersion, targetFromGitHubRepository } from './updateCheck';
import packageJson from '../../../package.json';

describe('업데이트 확인', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('화면 버전의 단일 원천은 package.json이다', () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it('semantic version을 숫자로 비교한다', () => {
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.1.0', '1.1.0')).toBe(false);
    expect(isNewerVersion('1.1.0-beta.2', '1.1.0')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.1.0-beta.2')).toBe(true);
    expect(isNewerVersion('not-a-version', '1.1.0')).toBe(false);
  });

  it('GitHub Pages 프로젝트 주소에서 main/package.json을 추론한다', () => {
    expect(inferGitHubPagesTarget(new URL('https://teacher.github.io/achievement-eval/'))).toEqual({
      packageUrl: 'https://raw.githubusercontent.com/teacher/achievement-eval/main/package.json',
      pageUrl: 'https://teacher.github.io/achievement-eval/',
      downloadUrl: 'https://github.com/teacher/achievement-eval/releases/latest/download/achievement-eval.html',
    });
    expect(inferGitHubPagesTarget(new URL('https://example.com/achievement-eval/'))).toBeNull();
  });

  it('package.json 저장소 주소로 단일 HTML의 업데이트 위치도 결정한다', () => {
    expect(targetFromGitHubRepository(
      'https://github.com/nginx-x/achievement-eval.git',
      'https://nginx-x.github.io/achievement-eval/',
    )).toEqual({
      packageUrl: 'https://raw.githubusercontent.com/nginx-x/achievement-eval/main/package.json',
      pageUrl: 'https://nginx-x.github.io/achievement-eval/',
      downloadUrl: 'https://github.com/nginx-x/achievement-eval/releases/latest/download/achievement-eval.html',
    });
  });

  it('새 버전이면 GitHub Release 단일 HTML 다운로드 주소를 반환한다', async () => {
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ version: '9.9.9' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));

    await expect(checkForUpdate()).resolves.toEqual({
      version: '9.9.9',
      pageUrl: 'https://nginx-x.github.io/achievement-eval/',
      downloadUrl: 'https://github.com/nginx-x/achievement-eval/releases/latest/download/achievement-eval.html',
    });
  });
});
