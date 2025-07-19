export default class WebXR {
  _arKitWrapper: any;
  xrPolyfill: any;

  constructor();
  init(): void;
  installAnchorsExtension(): void;
  installHitTestingExtension(): void;
  installRealWorldGeometryExtension(): void;
  installLightingEstimationExtension(): void;
  installNonstandardExtension(): void;
}
