// Enhance the server's items, then follow the live feed by setting each one's `left`.
import enhance from '@enhance/element';
import SliceItem from './slice-item.js';

enhance('slice-item', { ...SliceItem });

const live = new EventSource('/live');
live.onmessage = (event) => {
  for (const [key, left] of JSON.parse(event.data)) {
    const item = document.querySelector(`slice-item[item="${key}"]`);
    if (!item) continue;
    item.setAttribute('left', left ?? '');
    item.closest('li')?.classList.toggle('out', left != null && left <= 0);
  }
};
