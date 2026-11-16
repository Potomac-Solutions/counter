// Hydrate the server-rendered items, then follow the live feed.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import './slice-item.js';

const live = new EventSource('/live');
live.onmessage = (event) => {
  for (const [key, left] of JSON.parse(event.data)) {
    const item = document.querySelector(`slice-item[item="${key}"]`);
    if (item) item.left = left;
  }
};
