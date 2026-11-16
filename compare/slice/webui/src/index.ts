// Hydrate the menu's items, then follow the live feed.
import { startRuntime } from '@microsoft/webui-framework/runtime.js';
import type { SliceItem } from './slice-item/slice-item.js';
import './slice-item/slice-item.js';

startRuntime();

const live = new EventSource('/live');
live.onmessage = (event) => {
  for (const [key, left] of JSON.parse(event.data) as [string, number | null][]) {
    const item = document.querySelector<SliceItem>(`slice-item[item="${key}"]`);
    if (!item) continue;
    item.left = left ?? -1;
    item.closest('li')?.toggleAttribute('data-out', left != null && left <= 0);
  }
};
