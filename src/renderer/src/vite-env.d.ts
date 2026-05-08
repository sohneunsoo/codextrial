/// <reference types="vite/client" />

import type { FocusAlignedApi } from "../../preload";

declare global {
  interface Window {
    focusAligned: FocusAlignedApi;
  }
}
