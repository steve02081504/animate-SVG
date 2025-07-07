# SVG Animator

A simple JavaScript library to apply path drawing animations to SVG elements and export the result.

## Demo

Check out the live demo here: [https://steve02081504.github.io/animate-SVG/](https://steve02081504.github.io/animate-SVG/)

## How to Use

### 1. Import the Library

You can use the library by importing it as an ES module from the CDN.

```html
<script type="module">
    import { animateSVG, exportAnimatedSVG } from 'https://cdn.jsdelivr.net/gh/steve02081504/animate-SVG/index.mjs';
    // Your code here
</script>
```

### 2. Prepare your HTML

You need an SVG element in your HTML that you want to animate. You can either embed it directly or load it dynamically.

```html
<div id="svg-container">
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <path d="M10 10 H 90 V 90 H 10 Z" fill="none" stroke="black"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="blue"/>
    </svg>
</div>

<button id="play-button">Play Animation</button>
<button id="download-button">Download Animated SVG</button>
```

### 3. Animate the SVG

The `animateSVG` function takes an `<svg>` element as input and applies a CSS animation to all `<path>`, `<circle>`, `<rect>`, and other shape elements within it.

-   **`animateSVG(svgElement)`**: Modifies the given SVG element in-place to include the animation style and keyframes.

```javascript
import { animateSVG, exportAnimatedSVG } from 'https://cdn.jsdelivr.net/gh/steve02081504/animate-SVG/index.mjs';

const svgElement = document.querySelector('#svg-container svg');
const playButton = document.getElementById('play-button');

animateSVG(svgElement); // Apply animation on load

// Re-apply animation on click
playButton.addEventListener('click', () => {
    // To restart a CSS animation, you need to re-insert the element
    const newSvg = svgElement.cloneNode(true);
    svgElement.replaceWith(newSvg);
    animateSVG(newSvg);
});
```

### 4. Export the Animated SVG

The `exportAnimatedSVG` function returns a string containing the SVG with the animation styles embedded. This is useful for saving the animated SVG as a file.

-   **`exportAnimatedSVG(svgElement)`**: Returns a string representation of the SVG with embedded animation styles.

```javascript
import { animateSVG, exportAnimatedSVG } from 'https://cdn.jsdelivr.net/gh/steve02081504/animate-SVG/index.mjs';

const svgElement = document.querySelector('#svg-container svg');
const downloadButton = document.getElementById('download-button');

animateSVG(svgElement); // Ensure animation is applied first

downloadButton.addEventListener('click', () => {
    const svgString = exportAnimatedSVG(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animated.svg';
    a.click();
    URL.revokeObjectURL(url);
});
```

## How It Works

The library calculates the total length of each path-like element (path, circle, rect, etc.) and uses the `stroke-dasharray` and `stroke-dashoffset` CSS properties to create a drawing effect. A CSS animation (`@keyframes`) is dynamically generated and injected into a `<style>` tag within the SVG.