import { AppleBrowser } from "./utils/device-detection";
// Variant Launch SDK
import WebXR from "./webxr.js";
import {
  Platform,
  resolveBrowser,
  resolvePlatform,
  getLaunchPageData,
} from "./utils/device-detection";
import cameraVisibilityCheck from "./utils/cameraVisibilityCheck";

//import { generateQR } from "./utils/qr";
declare global {
  interface Window {
    VLaunch: VLaunch;
  }
}

export type VLaunchOptions = {
  key: string;
  url?: string;
  env?: string;
  autoLaunchRedirect?: boolean;
};

//ts enum for camera permissions
export enum CameraPermission {
  NotAsked = "not-asked",
  Denied = "denied",
  Granted = "granted",
}

//enum for xr status
export enum WebXRStatus {
  Unsupported = "unsupported",
  LaunchRequired = "launch-required",
  Supported = "supported",
}

const settings: Settings = {
  dev: { API_URL: "https://dev.launchar.app/api/v1" },
  staging: { API_URL: "https://staging.launchar.app/api/v1" },
  test: { API_URL: "https://staging.launchar.app/api/v1" },
  production: { API_URL: "https://launchar.app/api/v1" },
};

interface EnvironmentConfig {
  API_URL: string;
}

interface Settings {
  [key: string]: EnvironmentConfig;
  dev: EnvironmentConfig;
  staging: EnvironmentConfig;
  production: EnvironmentConfig;
}

export default class VLaunch {
  public initialized = false;
  public cameraPermission = CameraPermission.NotAsked;
  public webXRStatus = WebXRStatus.Unsupported;

  public platform = Platform.Desktop;
  private environment = "production";
  private polyfillInstalled = false;
  private webXR?: WebXR;
  private appleBrowser: AppleBrowser = AppleBrowser.None;
  private initUrl?: string;
  private debug = false;
  private autoLaunchRedirect = false;
  private injectedKey = "__LAUNCH_SDK_KEY__";
  private injectedEnv = "__LAUNCH_ENV__";
  private injectedAutoRedirect = "__LAUNCH_REDIRECT__";
  public getLaunchPageData;
  public cameraVisibilityCheck;

  // private xrPolyfill?: WebXRPolyfill;

  constructor() {
    this.platform = resolvePlatform();

    //methods
    this.getLaunchPageData = getLaunchPageData;
    this.cameraVisibilityCheck = cameraVisibilityCheck;

    //if VLdebug is set in url, set debug to true
    if (window.location.search.includes("VLdebug")) {
      this.debug = true;
    }
    resolveBrowser().then((browser) => {
      this.appleBrowser = browser;
      //new flow, we polyfill if Launch Viewer and init automatically
      if (this.appleBrowser === AppleBrowser.LaunchViewer) {
        this.webXR = new WebXR();
        this.webXR.init();
        this.log("XR support patched");
        this.polyfillInstalled = true;
      }

      // if sdk key is injected, we auto-init
      if (!this.injectedKey.includes("LAUNCH_SDK_KEY")) {
        this.init({
          key: this.injectedKey,
          env: this.injectedEnv,
          autoLaunchRedirect:
            this.injectedAutoRedirect === "true" ? true : false,
        });
      }
    });
  }

  public async init(options: VLaunchOptions): Promise<any> {
    this.environment = options.env ?? "production";
    if (this.environment !== "production") {
      this.debug = true;
      this.log("VLaunch debug mode enabled");
      this.log(options);
    }

    //this.webXR = new WebXR();
    if (this.appleBrowser == AppleBrowser.None) {
      //attempt to resolve browser
      this.appleBrowser = await resolveBrowser();
    }

    if (
      options.autoLaunchRedirect === true ||
      options.autoLaunchRedirect === false
    ) {
      this.autoLaunchRedirect = options.autoLaunchRedirect;
    }

    //below line POSTs sdk key to api to get user info
    const response = await fetch(
      `${settings[this.environment].API_URL}/sdk/init`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sdkKey: options.key,
          domain: window.location.hostname,
          browser: this.appleBrowser,
          url: options.url ?? window.location.href,
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error("Variant API error: " + (data as any).error);
    }

    const data = await response.json();
    const eventData: any = {};
    //eventData.isValid = data.isValid;
    eventData.launchUrl = data.launchUrl;
    this.initUrl = data.launchUrl;
    eventData.browser = this.appleBrowser;
    eventData.platform = this.platform;
    eventData.launchRequired = false;
    eventData.launchInstructions = null;
    if (
      this.platform === Platform.IOS &&
      this.appleBrowser !== AppleBrowser.LaunchViewer
    ) {
      eventData.launchRequired = true;
      eventData.launchInstructions = await this.getLaunchPageData()
        .launchInstructions;
    }
    this.webXRStatus = this.resolveWebXRStatus();
    eventData.webXRStatus = this.webXRStatus;

    if (this.debug) {
      console.log("VLaunch initialized", options);
      console.log(eventData);
    }
    this.initialized = true;

    const event = new CustomEvent("vlaunch-initialized", {
      detail: eventData,
    });
    window.dispatchEvent(event);

    this.log(event);

    if (this.autoLaunchRedirect === true && eventData.launchRequired) {
      window.location.href = eventData.launchUrl;
    }

    return eventData;
  }

  private resolveWebXRStatus(): WebXRStatus {
    let status = WebXRStatus.Unsupported;

    if (
      this.platform === Platform.IOS &&
      this.appleBrowser !== AppleBrowser.LaunchViewer
    ) {
      status = WebXRStatus.LaunchRequired;
    }

    if (
      this.platform !== Platform.IOS &&
      navigator.xr &&
      navigator.xr["isSessionSupported"]
    ) {
      status = WebXRStatus.Supported;
    }

    if (this.appleBrowser === AppleBrowser.LaunchViewer) {
      status = WebXRStatus.Supported;
    }
    return status;
  }

  public launch(url: string, launchPage?: string) {
    if (!this.initialized) {
      throw new Error("Variant Launch not initialized");
    }

    //if url is blank, use this page's url
    if (!url) {
      url = window.location.href;
    }

    //if we are in launch viewer, just navigate to the url
    if (this.appleBrowser === AppleBrowser.LaunchViewer) {
      window.location.href = url;
      return;
    }

    let launchUrl = this.getLaunchUrl(url);

    // if iframe is specified, we append it to the launch url
    if (launchPage) {
      if (!launchPage.startsWith("https://")) {
        throw new Error(
          "launchPage iframe must be a secure url (https://): " + launchPage
        );
      }
      launchUrl += "&iframe=" + encodeURIComponent(launchPage);
    }

    window.location.href = launchUrl;
    //construct launchURL and navigate to it
  }

  public getLaunchUrl(url: string): string {
    if (!this.initialized || !this.initUrl) {
      throw new Error("Variant Launch not initialized");
    }
    //replace url param 'url' with the url we want to launch
    const launchUrl = new URL(this.initUrl);
    launchUrl.searchParams.set("url", url);
    launchUrl.searchParams.set("browser", this.appleBrowser);
    return launchUrl.toString();
  }

  public async browserType() {
    return await resolveBrowser();
  }

  public requestVideoFrame(callback: (frame: any) => void, options: any) {
    if (!this.webXR!._arKitWrapper) {
      throw new Error(
        "Variant Launch: AR is not initialized. Cannot request video frame."
      );
    }
    this.webXR!._arKitWrapper._requestComputerVisionData();
    this.webXR!._arKitWrapper.addEventListener(
      "cv_data",
      (e: any) => {
        const data = {
          width: e.detail._buffers[0].size.width,
          height: e.detail._buffers[0].size.height,
          data: e.detail._buffers[0]._buffer,
          format: "base64Jpeg",
        };
        callback(data);
      },
      { once: true }
    );
  }

  /*
  public generateQR(url) {}

  public showQR(url, el) {
    const qr = generateQR(url);
    qr.append(el);
  }
  */

  public log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }
}

window.VLaunch = window.VLaunch || new VLaunch();
