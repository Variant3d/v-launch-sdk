/*
interface XRImageTrackingResult {
  [SameObject] readonly attribute XRSpace imageSpace;
  readonly attribute unsigned long index;
  readonly attribute XRImageTrackingState trackingState;
  readonly attribute float measuredWidthInMeters;
};
*/

export default class XRImageTrackingResult {
  //implement interface from above
  imageSpace = null;
  index = -1;
  trackingState = "emulated";
  measuredWidthInMeters = 0.0;

  constructor() {
    // set on window to meet playcanvas' check of image-tracking support
    // https://github.com/immersive-web/dom-overlays/issues/41
  }
}

//window.XRImageTrackingResult = XRImageTrackingResult;
