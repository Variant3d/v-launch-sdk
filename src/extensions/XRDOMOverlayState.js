export default class XRDOMOverlayState {
    type = "screen";
    constructor(_type) {
        this.type = _type;
        // set on window to meet playcanvas' check of off-standard Chrome implementation
        // https://github.com/immersive-web/dom-overlays/issues/41
        window.XRDOMOverlayState = XRDOMOverlayState;
    }    
}