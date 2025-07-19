import createOffscreenCanvas from "../utils/offscreenCanvasShim";
import base64 from "../lib/base64-binary.js";
import XRSpace from "webxr-polyfill/src/api/XRSpace";
import * as mat4 from "gl-matrix/src/gl-matrix/mat4";

export async function createDetectionImage(
  uid,
  buffer,
  width,
  height,
  widthInMeters
) {
  if (buffer instanceof ImageBitmap) {
    console.warn(
      "Launch: Session start speed and memory usage can be improved by sending ImageData instead of ImageBitmaps for tracked images on iOS."
    );
    const offscreenCanvas = new createOffscreenCanvas(
      buffer.width,
      buffer.height
    );

    const ctx = offscreenCanvas.getContext("2d");

    // Draw the ImageBitmap onto the offscreen canvas
    ctx.drawImage(buffer, 0, 0);

    // Retrieve the ImageData from the offscreen canvas
    const imageData = ctx.getImageData(0, 0, buffer.width, buffer.height);

    buffer = imageData.data;
  }
  return new Promise((resolve, reject) => {
    this._createDetectionImage(uid, buffer, width, height, widthInMeters)
      .then((detail) => {
        if (detail.error) {
          reject(detail.error);
          return;
        }
        if (!detail.created) {
          reject(null);
          return;
        }

        resolve({
          uid: uid,
          width: width,
          height: height,
          widthInMeters: widthInMeters,
        });
      })
      .catch((...params) => {
        console.error("could not create image", ...params);
        reject();
      });
  });
}

/*
 * ask for an detection image.
 *
 * Provide a uid for the anchor that will be created.
 * Supply the image in an ArrayBuffer, typedArray or ImageData
 * width and height are in meters
 */
export function _createDetectionImage(
  uid,
  buffer,
  width,
  height,
  widthInMeters
) {
  return this._sendMessage("createImageAnchor", {
    uid: uid,
    buffer: base64.encode(buffer),
    imageWidth: width,
    imageHeight: height,
    physicalWidth: widthInMeters,
    anchor: null,
  });
}

export async function _createDetectionImages(trackedImages) {
  this.setNumberOfTrackedImages(trackedImages.length);
  //must maintain order of trackedImages through this process
  this._trackedImages = await Promise.all(
    trackedImages.map((trackedImage) => {
      trackedImage.uid = crypto.randomUUID();

      return this.createDetectionImage(
        trackedImage.uid,
        trackedImage.image,
        trackedImage.image.width,
        trackedImage.image.height,
        trackedImage.widthInMeters
      );
    })
  );

  this._trackedImages.forEach((trackedImage) => {
    this.activateDetectionImage(trackedImage.uid, true);
  });

  return this._trackedImages;
}

export function destroyDetectionImage(uid) {
  return new Promise((resolve, reject) => {
    this._destroyDetectionImage(uid)
      .then((detail) => {
        if (detail.error) {
          reject(detail.error);
          return;
        }
        resolve();
      })
      .catch((...params) => {
        console.error("could not destroy image", ...params);
        reject();
      });
  });
}

export function _destroyDetectionImage(uid) {
  return this._sendMessage("destroyImageAnchor", {
    uid: uid,
  });
}

export function activateDetectionImage(uid, trackable = false) {
  return new Promise((resolve, reject) => {
    // when we delete an anchor, it refinds it. So, if we delete the anchor and then
    // call activate, there's a chance it will already have been found and created and
    // sent here
    const anchor = this._anchors.get(uid);
    if (anchor && !anchor.deleted) {
      // the anchor might still be here, but not been "recreated", so we only
      // use it if it's really been recreated
      resolve(anchor);
      return;
    }
    this._activateDetectionImage(uid, trackable)
      .then((detail) => {
        window.VLaunch.log(detail);
        //runs on successful activation or detection
        if (detail.error) {
          reject(detail.error);
          reject();
        }
        if (!detail.activated) {
          reject(null);
          return;
        }

        this._createOrUpdateAnchorObject(detail.imageAnchor);
        detail.imageAnchor.object.deleted = false;

        // find uuid in _trackedImages, pass imageAnchor by reference to trackedImage
        let trackedImage = this._trackedImages.find(
          (t) => t.uid === detail.imageAnchor.uuid
        );

        trackedImage.imageAnchor = detail.imageAnchor;
        trackedImage.score = "trackable";

        resolve(detail.imageAnchor.object);
      })
      .catch((...params) => {
        console.error("could not activate image", ...params);
        reject();
      });
  });
}

/*
 * activateDetectionImage activates an image and waits for the detection
 * @param uid The UID of the image to activate, previously created via "createImageAnchor"
 * @returns {Promise<any>} a promise that will be resolved when ARKit detects the image, or an error otherwise
 */
export function _activateDetectionImage(uid, trackable = false) {
  return this._sendMessage("activateDetectionImage", {
    uid: uid,
    trackable: trackable,
  });
}

export function deactivateDetectionImage(uid) {
  return new Promise((resolve, reject) => {
    this._deactivateDetectionImage(uid)
      .then((detail) => {
        if (detail.error) {
          reject(detail.error);
          reject;
        }

        // when we deactivate an image, there is a chance the anchor could still be
        // around.  Delete it
        const anchor = this._anchors.get(uid);
        if (anchor) {
          console.warn(
            "anchor for image target '" +
              uid +
              "' still exists after deactivation"
          );
          this.removeAnchor(anchor);
        }

        resolve();
      })
      .catch((...params) => {
        console.error("could not activate image", ...params);
        reject();
      });
  });
}

export function _deactivateDetectionImage(uid) {
  return this._sendMessage("deactivateDetectionImage", {
    uid: uid,
  });
}

export function setNumberOfTrackedImages(count) {
  this._sendMessage(
    "setNumberOfTrackedImages",
    {
      numberOfTrackedImages: typeof count === "number" ? count : 0,
    },
    true,
    false
  );
}

/* TODO - this always returns trackable, even if the image is not trackable */

export function getTrackedImageScores(device = null) {
  //we may arrive via the session or device objects. session passes the device manually
  let self = this;
  if (device) {
    self = device;
  }
  let scores = self._trackedImages.map((result) => {
    return result.score;
  });

  return Promise.resolve(scores);
}

export function getImageTrackingResults(localSpace) {
  return this._trackedImages.map((result, index) => {
    result.trackingState = "emulated";
    if (!result.imageSpace) {
      //TODO- deep copy localspace. do we want to do this once at activiation time so localspaces aren't all different?
      /*
      result.imageSpace = Object.assign(
        Object.create(Object.getPrototypeOf(localSpace)),
        localSpace
      );
      */

      // result.imageSpace = JSON.parse(JSON.stringify(localSpace));

      // Create a new XRSpace object and set its properties to match those of the localSpace object
      result.imageSpace = new XRSpace();
      if (localSpace && localSpace._baseMatrix) {
        result.imageSpace._baseMatrix = localSpace._baseMatrix;
      } else {
        //otherwise use a default matrix
        result.imageSpace._baseMatrix = new Float32Array([
          1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        ]);
      }
    }
    if (result.imageAnchor) {
      if (result.imageAnchor.object._poseChanged) {
        result.trackingState = "tracked";
        result.imageSpace._baseMatrix = result.imageAnchor.object._transform;
      }
    }
    //always update image pose for now, unsure if changes to users referencespace will change this value
    result.imageSpace._ensurePoseUpdated();

    return {
      index,
      trackingState: result.trackingState,
      imageSpace: result.imageSpace,
      uid: result.uid,
      transform: result.transform,
      width: result.width,
      height: result.height,
      measuredWidthInMeters: 0, //TODO - unsupported for now
    };
  });
}
