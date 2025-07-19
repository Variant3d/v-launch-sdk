export default function createOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    // If OffscreenCanvas is supported, use it
    return new OffscreenCanvas(width, height);
  } else {
    // Fallback to a regular canvas element
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = "none";
    return canvas;
  }
}
