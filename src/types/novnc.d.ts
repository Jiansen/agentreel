declare module "@novnc/novnc/lib/rfb.js" {
  export default class RFB {
    constructor(
      target: HTMLElement,
      urlOrChannel: string | WebSocket,
      options?: Record<string, unknown>
    );
    viewOnly: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    showDotCursor: boolean;
    addEventListener(event: string, handler: (...args: unknown[]) => void): void;
    disconnect(): void;
  }
}
