/**
 * @module svg-animator
 * @description 一个用于给 SVG 图像添加动态“绘制”和“填充”动画效果的模块。
 */

/**
 * 为 SVG 元素内的所有路径计算并应用动态的动画属性。
 * 这使得每个路径的绘制速度和延迟都不同，从而产生更自然、更生动的动画效果。
 * @private
 * @param {SVGElement} svgElement - 需要处理的 SVG DOM 元素。
 * @param {object} config - 包含动画参数的配置对象。
 * @param {number} config.animationDuration - 动画总时长（秒）。
 */
function addDynamicPathAttributes(svgElement, config) {
	const paths = svgElement.querySelectorAll('path')
	if (paths.length === 0) return

	const pathLengths = []
	for (const path of paths)
		pathLengths.push(path.getTotalLength())


	const maxLength = Math.max(...pathLengths)
	const minLength = Math.min(...pathLengths)

	paths.forEach((path, index) => {
		const totalLength = path.getTotalLength()
		if (totalLength === 0) return

		// 一个复杂的计算，旨在让短路径的动画不会结束得太快，增加视觉上的协调性
		const relativeLength = totalLength / maxLength
		const lengthCompensation = (minLength / maxLength) / relativeLength * (0.7 - minLength / maxLength)

		// 计算每个路径独立的动画时长，使其与路径长度成正比，并加入补偿值
		const pathAnimationDuration = (relativeLength + lengthCompensation) * (0.7 * config.animationDuration)

		// 设置 CSS 属性以实现绘制动画
		// stroke-dasharray 和 stroke-dashoffset 是实现“绘制”效果的核心
		path.style.strokeDasharray = totalLength
		path.style.strokeDashoffset = totalLength
		// 为每个路径设置不同的延迟，使其按顺序开始绘制
		path.style.animationDelay = `${index / paths.length}s`
		path.style.animationDuration = `${pathAnimationDuration}s`
	})
}

/**
 * 将动画所需的 CSS 样式（@keyframes）注入到 SVG 的 <defs> 部分。
 * 这使得导出的 SVG 文件是自包含的，无需外部 CSS 即可播放动画。
 * @private
 * @param {SVGElement} svgElement - 需要注入样式的 SVG DOM 元素。
 * @param {object} config - 包含动画参数的配置对象。
 * @param {number} config.animationDuration - 动画总时长（秒）。
 * @param {number} config.lineThickness - 绘制动画期间的线条粗细（百分比）。
 */
function insertAnimationStyles(svgElement, config) {
	let defsTag = svgElement.querySelector('defs')
	if (!defsTag) {
		defsTag = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
		svgElement.insertBefore(defsTag, svgElement.firstChild)
	}

	let styleTag = defsTag.querySelector('style')
	if (!styleTag) {
		styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style')
		defsTag.appendChild(styleTag)
	}

	// 避免重复注入样式
	if (styleTag.textContent.includes('@keyframes'))
		return


	const styleHTML = `
.animate-svg path {
	animation: draw ease-in-out forwards;
	stroke: currentColor;
}
.animate-svg {
	animation: fill-opacity ${config.animationDuration}s ease-in-out forwards;
}
@keyframes draw {
	100% {
	stroke-dashoffset: 0;
	}
}
@keyframes fill-opacity {
	0%, 70% {
	fill-opacity: 0;
	stroke-width: ${config.lineThickness}%;
	}
	100% {
	fill-opacity: 1;
	stroke-width: 0;
	}
}
`
	styleTag.textContent = styleHTML
}

/**
 * 以编程方式触发一个 DOM 事件。
 * @private
 * @param {Element} element - 目标 DOM 元素。
 * @param {string} eventType - 要触发的事件类型 (例如 'click')。
 */
function fireEvent(element, eventType) {
	if (element.fireEvent)
		element.fireEvent('on' + eventType)
	else {
		const event = document.createEvent('Events')
		event.initEvent(eventType, true, false)
		element.dispatchEvent(event)
	}
}

/**
 * 核心功能函数：为给定的 SVG 元素应用并触发绘制动画。
 * 它会修改 SVG，为其添加动画所需的属性和样式，并立即播放动画。
 * @param {SVGElement} svgElement - 要添加动画的 SVG DOM 元素。
 * @param {object} [options] - 可选的配置项。
 * @param {number} [options.animationDuration=3] - 动画总时长（秒）。
 * @param {number} [options.lineThickness=0.5] - 绘制动画期间的线条粗细（相对于 viewBox 的百分比）。
 * @returns {SVGElement} - 返回被修改后的 SVG 元素。
 */
export function animateSVG(svgElement, options = {}) {
	const config = {
		animationDuration: 3,
		lineThickness: 0.5,
		...options
	}

	if (!(svgElement instanceof SVGElement)) {
		console.error('animateSVG: 提供的参数不是一个有效的 SVG 元素。')
		return
	}

	// 1. 为每个 path 计算并设置动画参数
	addDynamicPathAttributes(svgElement, config)

	// 2. 将 CSS 动画规则注入 SVG
	insertAnimationStyles(svgElement, config)

	// 3. 通过添加 class 来触发动画
	if (!svgElement.classList.contains('animate-svg')) {
		svgElement.classList.add('animate-svg')

		// 动画结束后移除 class，以便可以重复触发
		setTimeout(() => {
			svgElement.classList.remove('animate-svg')
			// 清理空的 class 属性
			if (svgElement.getAttribute('class') === '')
				svgElement.removeAttribute('class')

		}, config.animationDuration * 1000)
	}

	return svgElement
}

/**
 * 将一个带有内嵌动画的 SVG 元素导出为 .svg 文件并触发下载。
 * @param {SVGElement} svgElement - 要导出的 SVG DOM 元素。
 * @returns {string} - 返回导出的HTML字符串。
 */
export function exportAnimatedSVG(svgElement) {
	if (!(svgElement instanceof SVGElement)) {
		console.error('exportAnimatedSVG: 提供的参数不是一个有效的 SVG 元素。')
		return
	}

	// 克隆节点以避免修改页面上原始的 SVG
	const svgToExport = svgElement.cloneNode(true)

	// 确保导出的 SVG 默认处于可动画状态
	svgToExport.classList.add('animate-svg')

	// 确保动画样式已注入
	insertAnimationStyles(svgToExport, { animationDuration: 3, lineThickness: 0.5 })

	const container = document.createElement('div')
	container.appendChild(svgToExport)

	return container.innerHTML
}
