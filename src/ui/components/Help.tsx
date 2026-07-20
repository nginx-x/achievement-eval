import type { ReactNode } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';

/** ⓘ 클릭/포커스 팝오버 (HeadlessUI · 터치·키보드 접근) */
export function Help({ children }: { children: ReactNode }) {
  return (
    <Popover className="help">
      <PopoverButton className="help-btn" aria-label="도움말">ⓘ</PopoverButton>
      <PopoverPanel anchor={{ to: 'bottom start', gap: 6 }} transition className="help-pop" role="tooltip">
        {children}
      </PopoverPanel>
    </Popover>
  );
}
