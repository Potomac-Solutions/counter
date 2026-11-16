// Follow the live feed: set each server-rendered item's `left`, and Stencil re-renders it.
const live = new EventSource('/live');
live.onmessage = (event) => {
  for (const [key, left] of JSON.parse(event.data)) {
    const item = document.querySelector(`slice-item[item="${key}"]`);
    if (!item) continue;
    item.left = left;
    item.closest('li')?.classList.toggle('out', left != null && left <= 0);
  }
};
