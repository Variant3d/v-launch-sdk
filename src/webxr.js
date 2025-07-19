import WebXRPolyfill from "webxr-polyfill/src/WebXRPolyfill";

import XRSystem from "webxr-polyfill/src/api/XRSystem";
import XRSession, {
  PRIVATE as XRSESSION_PRIVATE,
} from "webxr-polyfill/src/api/XRSession";

import * as mat4 from "gl-matrix/src/gl-matrix/mat4";
import * as vec3 from "gl-matrix/src/gl-matrix/vec3";

import API from "./extensions/index";

import ARKitDevice from "./arkit/ARKitDevice";
import ARKitWrapper from "./arkit/ARKitWrapper";

import XRAnchor from "./extensions/XRAnchor";
import XRHitTestResult from "./extensions/XRHitTestResult";
import XRHitTestSource from "./extensions/XRHitTestSource";
import XRTransientInputHitTestResult from "./extensions/XRTransientInputHitTestResult";
import XRTransientInputHitTestSource from "./extensions/XRTransientInputHitTestSource";
import XRDOMOverlayState from "./extensions/XRDOMOverlayState";
import XRImageTrackingResult from "./extensions/XRImageTrackingResult";
import XRRigidTransform from "webxr-polyfill/src/api/XRRigidTransform";

const _workingMatrix = mat4.create();
const _workingMatrix2 = mat4.create();

export default class WebXR {
  _arKitWrapper = null;
  xrPolyfill = null;
  constructor() {
    // Monkey patch the WebXR polyfill so that it only loads our special XRDevice
    WebXRPolyfill.prototype._patchNavigatorXR = function () {
      this.xr = new XRSystem(Promise.resolve(new ARKitDevice(this.global)));
      Object.defineProperty(this.global.navigator, "xr", {
        value: this.xr,
        configurable: true,
      });
    };

    this.xrPolyfill = new WebXRPolyfill(null, {
      webvr: false,
      cardboard: false,
    });

    if (this.xrPolyfill && this.xrPolyfill.injected && navigator.xr) {
      // install our ARKitWrapper
      this._arKitWrapper = ARKitWrapper.GetOrCreate();

      ARKitDevice.initStyles();

      // Some workarounds to let the official WebXR polyfill work with our polyfill

      if (window.XRSystem) {
        //console.log("XRSystem installed");
        // Note: The polyfill supports only immersive-ar mode for now.
        //       See https://github.com/MozillaReality/webxr-ios-js/pull/34#discussion_r334910337
        //       The official WebXR polyfill always accepts inline mode
        //       so overriding XRSystem.isSessionSupported and XRSystem.requestSession to refuse inline mode.
        // @TODO: Support inline mode. WebXR API specification defines that any XR Device must
        //        support inline mode
        XRSystem.prototype._isSessionSupported =
          XRSystem.prototype.isSessionSupported;
        XRSystem.prototype._requestSession = XRSystem.prototype.requestSession;

        //block sessions until init
      }
      this.installAnchorsExtension();
      this.installHitTestingExtension();
      this.installRealWorldGeometryExtension();
      this.installLightingEstimationExtension();
      this.installNonstandardExtension();

      // Inject Polyfill globals. Apply classes as globals.
      for (const className of Object.keys(API)) {
        if (window[className] !== undefined) {
          console.warn(`${className} already defined on global.`);
        } else {
          window[className] = API[className];
        }
      }

      this.installImageTrackingExtension();

      XRSystem.prototype.requestSession = () => {
        console.error("Variant Launch not Initialized");
      };
      XRSystem.prototype.isSessionSupported = () => {
        console.error("Variant Launch not Initialized");
      };
    }

    return this;
  }

  init() {
    if (this.xrPolyfill && this.xrPolyfill.injected && navigator.xr) {
      // install session interface
      XRSystem.prototype.isSessionSupported = function (mode) {
        if (!(mode === "immersive-ar" || mode === "inline"))
          return Promise.resolve(false);
        return this._isSessionSupported(mode);
      };
      XRSystem.prototype.requestSession = async function (mode, xrSessionInit) {
        if (!(mode === "immersive-ar" || mode === "inline")) {
          throw new DOMException(
            "Polyfill Error: only immersive-ar or inline mode is supported."
          );
        }
        window.VLaunch.log("requestSession", mode, xrSessionInit);

        // threejs requires this to be set in some contexts
        if (xrSessionInit.optionalFeatures === undefined) {
          xrSessionInit.optionalFeatures = [];
        }

        let session = await this._requestSession(mode, xrSessionInit);
        session[XRSESSION_PRIVATE].enabledFeatures = [];
        session[XRSESSION_PRIVATE].enabledFeatures.concat(
          xrSessionInit.requiredFeatures
        );

        if (
          xrSessionInit.requiredFeatures.includes("hit-test") ||
          xrSessionInit.optionalFeatures.includes("hit-test")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("hit-test");
        }

        if (
          xrSessionInit.requiredFeatures.includes("dom-overlay") ||
          xrSessionInit.optionalFeatures.includes("dom-overlay")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("dom-overlay");
        }

        if (
          xrSessionInit.requiredFeatures.includes("image-tracking") ||
          xrSessionInit.optionalFeatures.includes("image-tracking")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("image-tracking");
        }

        if (
          xrSessionInit.requiredFeatures.includes("local-floor") ||
          xrSessionInit.requiredFeatures.includes("local-floor")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("local-floor");
        }
        if (
          xrSessionInit.requiredFeatures.includes("local") ||
          xrSessionInit.optionalFeatures.includes("local")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("local");
        }

        if (
          xrSessionInit.requiredFeatures.includes("light-estimation") ||
          xrSessionInit.optionalFeatures.includes("light-estimation")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("light-estimation");
        }

        if (
          xrSessionInit.requiredFeatures.includes("anchors") ||
          xrSessionInit.optionalFeatures.includes("anchors")
        ) {
          session[XRSESSION_PRIVATE].enabledFeatures.push("anchors");
        }

        // TODO - HAX, support multiple ref spaces better
        if (mode === "immersive-ar") {
          if (
            xrSessionInit.requiredFeatures &&
            xrSessionInit.requiredFeatures.includes("local-floor")
          ) {
            await session.requestReferenceSpace("local-floor");
          } else {
            session[XRSESSION_PRIVATE]._localSpace =
              await session.requestReferenceSpace("local");
          }
        }

        // DOM overlay API
        if (
          xrSessionInit &&
          xrSessionInit.domOverlay &&
          xrSessionInit.domOverlay.root
        ) {
          session.domOverlayState = new XRDOMOverlayState("screen");
          const device = session[XRSESSION_PRIVATE].device;
          device.setDomOverlayRoot(xrSessionInit.domOverlay.root);
          device.setActiveXRSession(session);
          session[XRSESSION_PRIVATE].enabledFeatures.push("dom-overlay");
        }
        if (xrSessionInit && xrSessionInit.trackedImages) {
          const device = session[XRSESSION_PRIVATE].device;
          session[XRSESSION_PRIVATE].enabledFeatures.push("image-tracking");
          await device.setDetectionImages(xrSessionInit.trackedImages);
        }
        /*
        // MEGAHAX - worst possible way to get this to work for playcanvas. fix via a proper XRSession extension
        XRSession.prototype.enabledFeatures =
          session[XRSESSION_PRIVATE].enabledFeatures;
          */
        session.enabledFeatures = session[XRSESSION_PRIVATE].enabledFeatures;
        window.VLaunch.session = session;
        window.VLaunch.cameraVisibilityCheck(); // make sure BG elements are transparent
        window.VLaunch.log("session", session);
        return session;
      };
    }
  }

  // Install a few proposed AR extensions to the WebXR Device API
  // by adding the methods to XR*.prototype.
  // ARKitWrapper talks to Apple ARKit and instanciates XR resources
  // so that the extended WebXR API for AR basically just calls ARKitWrapper methods.

  // Anchors
  // Specification: https://github.com/immersive-web/anchors

  installAnchorsExtension() {
    if (window.XRFrame === undefined) {
      return;
    }

    Object.defineProperty(XRFrame.prototype, "trackedAnchors", {
      get: function () {
        const device = this.session[XRSESSION_PRIVATE].device;
        const anchorMap = device._arKitWrapper._anchors;
        // TODO - performance - cache this
        const anchorSet = new Set(anchorMap.values());
        return anchorSet;
      },
      enumerable: true,
      configurable: true,
    });

    XRFrame.prototype.createAnchor = function createAnchor(
      xrRigidTransform,
      referenceSpace
    ) {
      if (!this.session[XRSESSION_PRIVATE].immersive) {
        return Promise.reject();
      }

      return this.addAnchor(xrRigidTransform.matrix, referenceSpace);
    };

    /**
     * @param value {XRHitResult|Float32Array}
     * @param referenceSpace {XRReferenceSpace}
     * @return {Promise<XRAnchor>}
     */
    XRFrame.prototype.addAnchor = async function addAnchor(
      value,
      referenceSpace
    ) {
      if (!this.session[XRSESSION_PRIVATE].immersive) {
        return Promise.reject();
      }

      const device = this.session[XRSESSION_PRIVATE].device;

      //const workingMatrix1 = mat4.create();

      // @TODO: Replace XRHitResult with XRHitTestResult if needed

      /*
      if (value instanceof XRHitResult) {
        // let tempAnchor = await _arKitWrapper.createAnchorFromHit(value._hit);
        // value = tempAnchor.modelMatrix
        mat4.multiply(workingMatrix1, value._hit.anchor_transform, value._hit.local_transform)
        value = workingMatrix1
      } 
		*/
      if (value instanceof XRRigidTransform) {
        value = value.matrix;
      }

      if (value instanceof Float32Array) {
        // we assume that the eye-level reference frame (local reference space)
        // was obtained during requestSession below in this polyfill.
        // needs to be done so that this method doesn't actually need to
        // be async and wait

        let localReferenceSpace = this.session[XRSESSION_PRIVATE]._localSpace;
        mat4.copy(
          _workingMatrix,
          this.getPose(localReferenceSpace, referenceSpace).transform.matrix
        );
        const anchorInWorldMatrix = mat4.multiply(
          mat4.create(),
          _workingMatrix,
          value
        );

        return await device._arKitWrapper.createAnchor(anchorInWorldMatrix);
      } else {
        return Promise.reject("invalid value passed to addAnchor " + value);
      }
    };

    /**
     * Note: Defining delete() method here, not in XRAnchor.js, so far because
     *       I'm not sure if XRAnchor.js should have a dependency with _arKitWrapper.
     */
    XRAnchor.prototype.delete = function removeAnchor() {
      if (!this._arKitWrapper) return; // // Workaround: PlayCanvas may call WebXR features without waiting for session initialization.
      this._arKitWrapper.removeAnchor(this);
    };

    // @TODO: Support update event
  }

  // Hit-Testing
  // Specification: https://github.com/immersive-web/hit-test/

  installHitTestingExtension() {
    if (window.XRSession === undefined) {
      return;
    }

    // Hit test API

    XRSession.prototype.requestHitTestSource = function requestHitTestSource(
      options = {}
    ) {
      const source = new XRHitTestSource(this, options);
      const device = this[XRSESSION_PRIVATE].device;
      device.addHitTestSource(source);
      return Promise.resolve(source);
    };

    XRSession.prototype.requestHitTestSourceForTransientInput =
      function requestHitTestSourceForTransientInput(options = {}) {
        let hitTestOptionsInit = {
          profile: options.profile ? options.profile : "generic-touchscreen",
          offsetRay: options.offsetRay,
        };

        const source = new XRTransientInputHitTestSource(
          this,
          hitTestOptionsInit
        );
        const device = this[XRSESSION_PRIVATE].device;
        device.addTransientHitTestSource(source);
        return Promise.resolve(source);
      };

    XRFrame.prototype.getHitTestResults = function getHitTestResults(
      hitTestSource
    ) {
      const device = this.session[XRSESSION_PRIVATE].device;
      const hits = device.getHitTestResults(hitTestSource);
      const results = [];
      for (const hit of hits) {
        results.push(new XRHitTestResult(this, hit));
      }
      return results;
    };

    // WARNING: Hacky implementation
    XRFrame.prototype.getHitTestResultsForTransientInput =
      function getTransientInputHitTestResult(hitTestSource) {
        const device = this.session[XRSESSION_PRIVATE].device;
        const inputSource = device._gamepadInputSources[0].inputSource; //hitTestSource.inputSource;
        //const inputSource = device._cachedHitTestInputSource; // HAX/TODO - this is hardocded as we only ever support one. will be ovewriteen with latest on retreival
        const hits = device.getTransientHitTestResults(hitTestSource); //just a bundle of hits
        //sort hits by .distance value
        hits.sort((a, b) => {
          return a.distance - b.distance;
        });

        const results = [];
        for (let i = 0; i < hits.length; i++) {
          // TODO URGENT - hits[i] seems wrong here as its a raw hittest result, not a transform. FIX
          const hit = hits[i];
          results.push(new XRHitTestResult(this, hit));
        }

        //TODO- check, because results should be ordered by distance
        return [new XRTransientInputHitTestResult(this, results, inputSource)];
      };
  }

  installImageTrackingExtension() {
    //fix for playcanvas https://forum.playcanvas.com/t/webxr-image-detection-method-causing-issues/31534
    window.XRImageTrackingResult = XRImageTrackingResult;
    XRSession.prototype.getTrackedImageScores =
      function getTrackedImageScores() {
        //return early if this isn't an image-tracking session
        if (!this.session || !this.session[XRSESSION_PRIVATE]) {
          window.VLaunch.log(
            "getTrackedImageScores : image tracking not initialized"
          );
          return Promise.resolve([]);
        }
        const device = this.session[XRSESSION_PRIVATE].device;
        return device._arKitWrapper.getTrackedImageScores(device);
      };

    XRFrame.prototype.getImageTrackingResults =
      function getImageTrackingResults() {
        //skip if this isn't an image-tracking session
        if (!this.session || !this.session[XRSESSION_PRIVATE]) {
          window.VLaunch.log(
            "getImageTrackingResults : image tracking not initialized"
          );
          return Promise.resolve([]);
        }

        const device = this.session[XRSESSION_PRIVATE].device;
        const localSpace = this.session[XRSESSION_PRIVATE]._localSpace;
        return device.getImageTrackingResults(localSpace);
      };
  }

  // Real World Geometry
  // Specification: https://github.com/immersive-web/real-world-geometry

  installRealWorldGeometryExtension() {
    if (window.XRFrame === undefined || window.XRSession === undefined) {
      return;
    }

    /**
     *
     */
    Object.defineProperty(XRFrame.prototype, "worldInformation", {
      get: function getWorldInformation() {
        if (!this.session[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }

        return this._arKitWrapper.getWorldInformation();
      },
    });

    /**
     * Note: The name in the newest explainer(10/18/2019) seems updateWorldTrackingState.
     * @TODO: Rename if needed.
     *
     * @param options {Object}
     * @return
     */
    XRSession.prototype.updateWorldSensingState =
      function UpdateWorldSensingState(options) {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }

        return this._arKitWrapper.updateWorldSensingState(options);
      };
  }

  // Lighting Estimation
  // Specification: https://github.com/immersive-web/lighting-estimation

  installLightingEstimationExtension() {
    if (window.XRFrame === undefined) {
      return;
    }

    /*
     * @return {XRLightProbe}
     */
    XRFrame.prototype.getGlobalLightEstimate = function () {
      if (!this.session[XRSESSION_PRIVATE].immersive) {
        throw new Error("Not implemented");
      }

      return this._arKitWrapper.getLightProbe();
    };

    // @TODO: Implement
    XRFrame.prototype.getGlobalReflectionProbe = function () {
      throw new Error("Not implemented");
    };
  }

  // iOS specific things. No WebXR API extension proposal yet
  // so adding as XRSession.prototype.nonstandard_* for now.

  installNonstandardExtension() {
    if (window.XRSession === undefined) {
      return;
    }
    /*

    // CAN BE DELETED WHEN IMAGE tRACKING WROKING - no useful info here
    XRSession.prototype.nonStandard_setNumberOfTrackedImages =
      function setNumberOfTrackedImages(count) {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }

        return this._arKitWrapper.setNumberOfTrackedImages(count);
      };


    XRSession.prototype.nonStandard_createDetectionImage =
      function createDetectionImage(
        uid,
        buffer,
        width,
        height,
        physicalWidthInMeters
      ) {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }
        return this._arKitWrapper.createDetectionImage(
          uid,
          buffer,
          width,
          height,
          physicalWidthInMeters
        );
      };


    XRSession.prototype.nonStandard_destroyDetectionImage =
      function destroyDetectionImage(uid) {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }
        return this._arKitWrapper.createDetectionImage(uid);
      };


    XRSession.prototype.nonStandard_activateDetectionImage =
      function activateDetectionImage(uid) {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }
        return this._arKitWrapper.activateDetectionImage(uid);
      };


    XRSession.prototype.nonStandard_deactivateDetectionImage =
      function deactivateDetectionImage(uid) {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }
        return this._arKitWrapper.deactivateDetectionImage(uid);
      };
*/

    /**
     * @return
     */
    XRSession.prototype.nonStandard_getWorldMap = function getWorldMap() {
      if (!this[XRSESSION_PRIVATE].immersive) {
        throw new Error("Not implemented");
      }
      return this._arKitWrapper.getWorldMap();
    };

    /**
     * @param
     * @return
     */
    XRSession.prototype.nonStandard_setWorldMap = function setWorldMap(
      worldMap
    ) {
      if (!this[XRSESSION_PRIVATE].immersive) {
        throw new Error("Not implemented");
      }
      return _arKitWrapper.setWorldMap(worldMap);
    };

    /**
     * @return
     */
    XRSession.prototype.nonStandard_getWorldMappingStatus =
      function getWorldMappingStatus() {
        if (!this[XRSESSION_PRIVATE].immersive) {
          throw new Error("Not implemented");
        }
        return this._arKitWrapper._worldMappingStatus;
      };
  }
}
