/**
 * Copyright (c) 2019 Mozilla Inc. All Rights Reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// extension from https://raw.githubusercontent.com/MozillaReality/WebXR-emulator-extension/dev/src/polyfill/api/XRTransientInputHitTestResult.js

import XRPose from "webxr-polyfill/src/api/XRPose";

export const PRIVATE = Symbol("@@webxr-polyfill/XRTransientInputHitTestResult");

export default class XRTransientInputHitTestResult {
  constructor(frame, results, inputSource) {
    this[PRIVATE] = {
      frame,
      inputSource,
      results,
    };
  }

  get inputSource() {
    return this[PRIVATE].inputSource;
  }

  get results() {
    return this[PRIVATE].results;
  }

  createAnchor() {
    // TODO / HAX : until we rewrite the anchor handling
    return window.VLaunch.webXR._arKitWrapper.createAnchorFromHit(this);
  }
}
