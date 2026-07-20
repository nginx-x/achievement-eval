import { describe, expect, it } from 'vitest';
import { APP_VERSION, inferGitHubPagesTarget, isNewerVersion, targetFromGitHubRepository } from './updateCheck';
import packageJson from '../../../package.json';

describe('업데이트 확인', () => {
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
    });
  });
});
