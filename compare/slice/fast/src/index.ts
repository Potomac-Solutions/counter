// Reuse the server-rendered items, then follow the live feed.
import { enableHydration } from '@microsoft/fast-element/hydration.js';

enableHydration();
const { SliceItem } = await import('./slice-item/slice-item.js');

const live = new EventSource('/live');
live.onmessage = (event) => {
  for (const [key, left] of JSON.parse(event.data) as [string, number | null][]) {
    const item = document.querySelector<InstanceType<typeof SliceItem>>(`slice-item[item="${key}"]`);
    if (!item) continue;
    item.left = left ?? -1;
    item.closest('li')?.toggleAttribute('data-out', left != null && left <= 0);
  }
};
