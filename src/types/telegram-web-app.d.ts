export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

export type TelegramNamespace = {
  WebApp?: TelegramWebApp;
};

declare global {
  interface Window {
    Telegram?: TelegramNamespace;
  }
}

export {};
