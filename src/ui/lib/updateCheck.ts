import packageJson from '../../../package.json';

export const APP_VERSION = packageJson.version;

export interface UpdateInfo {
  version: string;
  pageUrl: string;
}

interface UpdateTarget {
  packageUrl: string;
  pageUrl: string;
}

interface PackageMetadata {
  repository?: string | { url?: string };
  homepage?: string;
}

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parseVersion(version: string): { core: number[]; prerelease: string | null } | null {
  const match = VERSION_RE.exec(version.trim());
  if (!match) return null;
  return { core: [+match[1], +match[2], +match[3]], prerelease: match[4] ?? null };
}

/** 원격 버전이 현재 버전보다 높은지 비교한다. 정식 버전은 같은 번호의 prerelease보다 높다. */
export function isNewerVersion(remote: string, current: string): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  }
  if (a.prerelease == null && b.prerelease != null) return true;
  if (a.prerelease != null && b.prerelease == null) return false;
  return (a.prerelease ?? '').localeCompare(b.prerelease ?? '', undefined, { numeric: true }) > 0;
}

/** https://owner.github.io/repo/ 주소에서 GitHub 저장소와 main/package.json URL을 추론한다. */
export function inferGitHubPagesTarget(pageUrl: URL): UpdateTarget | null {
  const match = /^([a-z0-9-]+)\.github\.io$/i.exec(pageUrl.hostname);
  if (!match) return null;
  const owner = match[1];
  const firstPath = pageUrl.pathname.split('/').filter(Boolean)[0];
  const repo = firstPath ?? `${owner}.github.io`;
  return {
    packageUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`,
    pageUrl: firstPath ? `${pageUrl.origin}/${repo}/` : `${pageUrl.origin}/`,
  };
}

/** package.json repository/homepage에서 배포 위치와 main/package.json을 만든다. */
export function targetFromGitHubRepository(repository: string, homepage?: string): UpdateTarget | null {
  const normalized = repository.trim().replace(/\.git$/i, '');
  const match = /github\.com[/:]([^/]+)\/([^/#]+)$/i.exec(normalized);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  return {
    packageUrl: `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`,
    pageUrl: homepage?.trim() || `https://${owner}.github.io/${repo}/`,
  };
}

function configuredTarget(): UpdateTarget | null {
  const packageUrl = import.meta.env.VITE_UPDATE_PACKAGE_URL?.trim();
  const pageUrl = import.meta.env.VITE_UPDATE_PAGE_URL?.trim();
  if (packageUrl) return { packageUrl, pageUrl: pageUrl || packageUrl };
  const metadata = packageJson as PackageMetadata;
  const repository = typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url;
  if (repository) {
    const fromPackage = targetFromGitHubRepository(repository, metadata.homepage);
    if (fromPackage) return fromPackage;
  }
  return inferGitHubPagesTarget(new URL(window.location.href));
}

/** 실패·오프라인은 정상적인 무응답으로 처리한다. 호출자는 UI 로딩을 기다릴 필요가 없다. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (navigator.onLine === false) return null;
  const target = configuredTarget();
  if (!target) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);
  try {
    const url = new URL(target.packageUrl);
    url.searchParams.set('_update_check', String(Date.now()));
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const version = typeof data === 'object' && data != null && 'version' in data
      ? String((data as { version: unknown }).version)
      : '';
    return isNewerVersion(version, APP_VERSION) ? { version, pageUrl: target.pageUrl } : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
