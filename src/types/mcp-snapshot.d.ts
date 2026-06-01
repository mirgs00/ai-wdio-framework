declare module '@wdio/mcp/snapshot' {
  interface BrowserElementInfo {
    tagName: string;
    name: string;
    type: string;
    value: string;
    href: string;
    selector: string;
    isInViewport: boolean;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  interface AccessibilityNode {
    role: string;
    name: string;
    selector: string;
    level: number | string;
    disabled: string;
    checked: string;
    expanded: string;
    selected: string;
    pressed: string;
    required: string;
    readonly: string;
  }

  export function getInteractableBrowserElements(
    browser: WebdriverIO.Browser,
  ): Promise<BrowserElementInfo[]>;

  export function getBrowserAccessibilityTree(
    browser: WebdriverIO.Browser,
  ): Promise<AccessibilityNode[]>;
}
