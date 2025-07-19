export default function cameraVisibilityCheck() {
  try {
    const body = document.body;
    const html = document.documentElement;
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      console.warn(
        "Variant Launch: No Canvas found. Skipping visibility check."
      );
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();

    // Check transparency for body and html
    function checkTransparency(element: Element, name: string) {
      const bgColor = window
        .getComputedStyle(element)
        .getPropertyValue("background-color");

      const bg = window
        .getComputedStyle(element)
        .getPropertyValue("background");

      const opacity = window
        .getComputedStyle(element)
        .getPropertyValue("opacity");

      const isTransparent = (color: string) => {
        if (color === "transparent") return true;

        if (color.startsWith("rgba") || color.startsWith("hsla")) {
          const alpha = parseFloat(
            color.slice(color.lastIndexOf(",") + 1, color.length - 1)
          );
          if (alpha === 0) return true;
        }

        return false;
      };

      const bgLayers = bg.split(",");
      const hasTransparentBgLayer = bgLayers.some((layer) =>
        isTransparent(layer)
      );

      if (
        !isTransparent(bgColor) &&
        !isTransparent(bg) &&
        !hasTransparentBgLayer &&
        parseFloat(opacity) == 1
      ) {
        console.warn(
          `Variant Launch: The ${name} element is not transparent. This may block your video feed. You can ignore this message if you set transparency on session start`,
          element
        );
      }
    }

    // Check canvas background transparency
    checkTransparency(canvas, "canvas");

    // Sample points on the canvas
    const samplePoints = [
      {
        x: canvasRect.left + canvasRect.width / 2,
        y: canvasRect.top + canvasRect.height / 2,
      },
      {
        x: canvasRect.left + canvasRect.width * 0.1,
        y: canvasRect.top + canvasRect.height * 0.1,
      },
      {
        x: canvasRect.left + canvasRect.width * 0.9,
        y: canvasRect.top + canvasRect.height * 0.1,
      },
      {
        x: canvasRect.left + canvasRect.width * 0.1,
        y: canvasRect.top + canvasRect.height * 0.9,
      },
      {
        x: canvasRect.left + canvasRect.width * 0.9,
        y: canvasRect.top + canvasRect.height * 0.9,
      },
    ];

    // Collect common elements behind the canvas
    const commonElements = samplePoints.reduce(
      (elements: Element[], point): Element[] => {
        const newElements = [];
        const pointElements = document
          .elementsFromPoint(point.x, point.y)
          .reverse();

        for (const el of pointElements) {
          if (el === canvas) break; // Stop collecting elements once we reach the canvas
          if (!elements.includes(el)) newElements.push(el);
        }

        return [...elements, ...newElements];
      },
      []
    );

    // Check transparency for common elements
    commonElements.forEach((element) => {
      checkTransparency(element, element.tagName);
    });
  } catch (e) {
    console.error(e);
  }
}
