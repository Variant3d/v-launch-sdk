/**
 * Copyright (c) 2019 Mozilla Inc. All Rights Reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// partial source: https://github.com/MozillaReality/WebXR-emulator-extension/blob/dev/src/polyfill/api/XRTransientInputHitTestSource.js

export const PRIVATE = Symbol("@@webxr-polyfill/XRTransientInputHitTestSource");

export default class XRTransientInputHitTestSource {
  constructor(session, options) {
    //constructor(options) {
    // @TODO: Support options.entityTypes and options.offsetRay
    if (options.entityTypes && options.entityTypes.length > 0) {
      throw new Error(
        "XRTransientInputHitTestSource does not support entityTypes option yet."
      );
    }
    this[PRIVATE] = {
      session,
      profile: options.profile,
      offsetRay: options.offsetRay || new XRRay(),
      active: true,
    };
  }

  cancel() {
    // @TODO: Throw InvalidStateError if active is already false
    this[PRIVATE].active = false;
  }

  get _profile() {
    return this[PRIVATE].profile;
  }

  get _session() {
    return this[PRIVATE].session;
  }

  get _offsetRay() {
    return this[PRIVATE].offsetRay;
  }

  get _active() {
    return this[PRIVATE].active;
  }
}
