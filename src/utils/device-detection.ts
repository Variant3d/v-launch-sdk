import { detectIncognito } from "detectincognitojs";

export enum Platform {
  Desktop = "desktop",
  IOS = "ios",
  Android = "android",
}

export enum AppleBrowser {
  None = "none",
  Safari = "safari",
  WKWebView = "wkwebview",
  PrivateSafari = "private-safari",
  IOSChrome = "ios-chrome",
  LaunchViewer = "launch-viewer",
  Facebook = "wk-facebook",
  Instagram = "wk-instagram",
  LinkedIn = "wk-linkedin",
  Line = "wk-line",
  WeChat = "wk-wechat",
  Snapchat = "wk-snapchat",
}

// one instruction per browser

const instructions = {
  none: "Tap 'Open' on the banner to launch AR",
  safari: "Tap 'Open' on the banner to launch AR",
  wkwebview:
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
  "private-safari":
    "Safari is in Private mode. Tap & hold to copy the link below to a non-private tab.",
  "ios-chrome":
    "You must be in Safari to launch AR. Tap & hold to copy the link below to a Safari tab.",
  "launch-viewer": "",
  "wk-facebook":
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
  "wk-instagram":
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
  "wk-linkedin":
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
  "wk-line":
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
  "wk-wechat":
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
  "wk-snapchat":
    "Tap and hold, then select 'Open Link', or copy the link and paste it in Safari.",
};

export async function getLaunchInstructions() {
  let browser = await resolveBrowser();
  return instructions[browser];
}

export async function getLaunchPageData() {
  let launchInstructions = await getLaunchInstructions();
  let browser = await resolveBrowser();

  return { browser, launchInstructions };
}

export function resolvePlatform() {
  if (isLaunchViewer()) {
    return Platform.IOS;
  }
  if (isAndroid()) {
    return Platform.Android;
  }
  if (isIOS()) {
    return Platform.IOS;
  }
  return Platform.Desktop;
}

export async function resolveBrowser() {
  if (isLaunchViewer()) {
    return AppleBrowser.LaunchViewer;
  }

  if (!isIOS()) {
    return AppleBrowser.None;
  }

  if (isChromeBrowser()) {
    return AppleBrowser.IOSChrome;
  }

  let known = getKnownWebview();
  if (known !== null) {
    return known;
  }

  if (isWKWebView()) {
    return AppleBrowser.WKWebView;
  }

  if (await isPrivateModeSafari()) {
    return AppleBrowser.PrivateSafari;
  }

  return AppleBrowser.Safari;
}

export function isIOS() {
  // resources for future iOS checks: https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/constants.ts
  let userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;
  return !!(
    (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) || // older devices
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 1)
  );
}

export function isLaunchViewer(): boolean {
  const isWebXRViewer = navigator.userAgent.indexOf("Variant Launch") !== -1;
  return isWebXRViewer;
}

export async function isPrivateModeSafari(): Promise<boolean> {
  const result = await detectIncognito();
  //console.log(result.browserName, result.isPrivate);
  return result.isPrivate;
}

export function isChromeBrowser(): boolean {
  const userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;
  return userAgent.indexOf("CriOS") > -1;
}

export function isWKWebView(): boolean {
  // TODO - check if this works when WKwebview is not using messagehandlers/has them disabled
  if ((window as any).webkit && (window as any).webkit.messageHandlers) {
    return true;
  }
  return false;
}

export function getKnownWebview(): AppleBrowser | null {
  const userAgent =
    navigator.userAgent || navigator.vendor || (window as any).opera;
  let result: AppleBrowser | null = null;
  if (userAgent.indexOf("FBAN") > -1 || userAgent.indexOf("FBAV") > -1) {
    result = AppleBrowser.Facebook;
  }
  if (userAgent.indexOf("LinkedInApp") > -1) {
    result = AppleBrowser.LinkedIn;
  }
  if (userAgent.indexOf("Instagram") > -1) {
    result = AppleBrowser.Instagram;
  }
  if (userAgent.indexOf(" Line") > -1) {
    result = AppleBrowser.Line;
  }
  if (userAgent.indexOf("MicroMessenger") > -1) {
    result = AppleBrowser.WeChat;
  }
  if (userAgent.indexOf("Snapchat") > -1) {
    result = AppleBrowser.Snapchat;
  }
  return result;
}

export function isAndroid() {
  let ua = navigator.userAgent.toLowerCase();
  return ua.indexOf("android") > -1;
}
