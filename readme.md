# SVG Animator

A JavaScript library for applying path drawing animations to SVG elements and exporting the result.

## Demo

Check out the live demo here: [https://steve02081504.github.io/animate-SVG/](https://steve02081504.github.io/animate-SVG/)

## Features

- Applies dynamic "drawing" animations to `<path>` elements within SVGs.
- **Recursively expands `<use>` tags**, supporting both inline and external SVG file references (e.g., SVG Sprite).
- Configurable animation parameters (e.g., duration, line thickness).
- Ability to export the animated SVG as a self-contained `.svg` file.
- **Asynchronous API**, utilizing modern `async/await` syntax.

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

You need an SVG element in your HTML that you want to animate. The library handles `<path>` elements and `<use>` elements that reference paths or symbols.

```html
<div id="svg-container">
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <defs>
            <circle id="internal-circle" cx="50" cy="50" r="40" fill="none" stroke="blue"/>
        </defs>
    
        <path d="M10 10 H 90 V 90 H 10 Z" fill="none" stroke="black"/>
        <use href="#internal-circle" />
    </svg>
</div>

<button id="play-button">Play Animation</button>
<button id="download-button">Download Animated SVG</button>
```

## API

### `animateSVG(svgElement, options)`

This function is **asynchronous**. It modifies the given SVG element in-place to apply the animation effect.

- **Returns**: `Promise<SVGElement>` - A Promise that resolves with the modified SVG element.

### `exportAnimatedSVG(svgElement, options)`

This function is also **asynchronous**. It clones the SVG element, applies the animation, and then returns an SVG string containing the embedded animation styles.

- **Returns**: `Promise<string>` - A Promise that resolves with the SVG string.

## Configuration Options

Both `animateSVG` and `exportAnimatedSVG` functions accept an optional `options` object to customize the animation:

```javascript
const options = {
    animationDuration: 3,     // Total animation duration in seconds
    lineThickness: 0.5,       // Line thickness as a percentage of the viewBox
    basePath: document.baseURI // Base path for resolving external <use> references
};
```

## Examples

### Playing Animation

```javascript
import { animateSVG } from 'https://cdn.jsdelivr.net/gh/steve02081504/animate-SVG/index.mjs';

const svgElement = document.querySelector('#svg-container svg');

// Play automatically on page load
await animateSVG(svgElement, { animationDuration: 5 });
```

### Replaying Animation

```javascript
const playButton = document.getElementById('play-button');

playButton.addEventListener('click', async () => {
    // To restart the animation, we clone and replace the original node.
    const oldSvg = document.querySelector('#svg-container svg');
    const newSvg = oldSvg.cloneNode(true);
    oldSvg.replaceWith(newSvg);
    
    // Apply animation to the new node
    await animateSVG(newSvg);
});
```

### Exporting Animated SVG

```javascript
import { exportAnimatedSVG } from 'https://cdn.jsdelivr.net/gh/steve02081504/animate-SVG/index.mjs';

const svgElement = document.querySelector('#svg-container svg');
const downloadButton = document.getElementById('download-button');

downloadButton.addEventListener('click', async () => {
    const svgString = await exportAnimatedSVG(svgElement);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animated.svg';
    a.click();
    URL.revokeObjectURL(url);
});
```

## Asynchronous Behavior and `<use>` Expansion

A key feature of this library is its ability to recursively expand `<use>` elements. This allows you to animate complex SVGs that are composed of multiple parts or icons from an external sprite sheet.

Since `<use>` elements can reference external files (e.g., `<use href="icons.svg#home">`), the library may need to fetch these files over the network. This is an asynchronous operation. Therefore, both `animateSVG` and `exportAnimatedSVG` are `async` functions, and you must use `await` or `.then()` to handle their results.

The `basePath` option is crucial when your SVG uses relative paths for external resources, ensuring they can be resolved correctly.

## How It Works

The library performs the following steps:

1. **Expands `<use>` tags**: It finds all `<use>` elements and replaces them with the actual content they reference, whether from within the document or an external file. This process is recursive.
2. **Finds Paths**: It queries the expanded SVG for all `<path>` elements. Note that other shapes (like `<circle>` or `<rect>`) are not directly animated unless they are defined as part of a `<symbol>` and introduced via a `<use>` tag.
3. **Calculates Length**: It calculates the total length of each path.
4. **Applies Styles**: It uses the CSS `stroke-dasharray` and `stroke-dashoffset` properties to create the drawing effect.
5. **Injects Animation**: A CSS `@keyframes` animation is dynamically generated based on the configuration and injected into a `<style>` tag within the SVG's `<defs>` section.
