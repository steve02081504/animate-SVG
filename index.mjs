/**
 * @module svg-animator
 * @description 一个用于给 SVG 图像添加动态“绘制”和“填充”动画效果的模块。
 * 支持递归展开 <use> 标签（包括外部 URL 引用），实现完美的动画控制。
 */

/**
 * @typedef {object} AnimateSVGOptions
 * @property {number} [animationDuration=3] - 动画总时长（秒）。
 * @property {number} [lineThickness=0.5] - 绘制动画期间的线条粗细（相对于 viewBox 的百分比）。
 * @property {string} [basePath] - 解析外部引用时的基准路径。默认为当前文档路径。
 */

/**
 * 缓存下载的外部 SVG 文档，避免重复请求。
 * @type {Map<string, Document>}
 */
const externalSvgCache = new Map()

/**
 * 辅助函数：基于基准路径解析目标 URL。
 * @param {string} baseUrl - 当前上下文的基准 URL。
 * @param {string} relativeUrl - 相对 URL。
 * @returns {string} 解析后的完整 URL。
 */
function resolveUrl(baseUrl, relativeUrl) {
	try {
		return new URL(relativeUrl, baseUrl).href
	} catch (e) {
		console.warn('URL 解析失败:', e)
		return relativeUrl
	}
}

/**
 * 加载外部 SVG 文件。
 * @param {string} url - SVG 文件的完整 URL。
 * @returns {Promise<Document|null>} 解析后的 XML 文档，或在失败时返回 null。
 */
async function loadExternalSvg(url) {
	const [cleanUrl] = url.split('#')

	if (externalSvgCache.has(cleanUrl))
		return externalSvgCache.get(cleanUrl)

	try {
		const response = await fetch(cleanUrl)
		if (!response.ok) throw new Error(`Failed to load ${cleanUrl}`)
		const text = await response.text()
		const parser = new DOMParser()
		const doc = parser.parseFromString(text, 'image/svg+xml')
		externalSvgCache.set(cleanUrl, doc)
		return doc
	} catch (error) {
		console.error('SVG fetch error:', error)
		return null
	}
}

/**
 * 将 <use> 标签递归展开为实际的 DOM 结构。
 * @param {SVGElement} rootElement - 当前正在处理的根元素 (可能是 SVG 或 G)。
 * @param {string} currentBaseUrl - 当前上下文的基准 URL，用于解析相对路径。
 * @param {number} [maxDepth=10] - 递归深度限制，防止循环引用。
 * @returns {Promise<void>}
 */
async function expandUseElements(rootElement, currentBaseUrl, maxDepth = 10) {
	if (maxDepth <= 0) return

	// 获取所有 <use> 元素。转为数组以避免在遍历和修改 DOM 时产生问题。
	const useElements = Array.from(rootElement.querySelectorAll('use'))

	if (useElements.length === 0) return

	await Promise.all(useElements.map(async (useEl) => {
		const rawHref = useEl.getAttribute('href') || useEl.getAttribute('xlink:href')
		if (!rawHref) return

		let targetElement = null
		let nextBaseUrl = currentBaseUrl

		const isExternal = !rawHref.startsWith('#')

		if (isExternal) {
			const fullUrl = resolveUrl(currentBaseUrl, rawHref)
			const [urlPart, idPart] = fullUrl.split('#')

			const doc = await loadExternalSvg(urlPart)
			if (doc) {
				// 如果有 ID 则获取特定元素，否则引用整个 SVG。
				targetElement = idPart ? doc.getElementById(idPart) : doc.documentElement
				// 递归时使用被引用 SVG 的 URL 作为基准，以正确解析其内部的相对路径。
				nextBaseUrl = urlPart
			}
		}
		else { // 内部引用 (#id)
			const id = rawHref.substring(1)
			const rootDoc = rootElement.ownerDocument || document
			// 如果 rootElement 是独立 fetch 下来的片段，getElementById 可能找不到，需用 querySelector 兜底。
			targetElement = rootDoc.getElementById(id) || rootElement.querySelector(`[id="${id}"]`)
		}

		if (!targetElement)
			// console.warn(`Target not found for href: ${rawHref} in context ${currentBaseUrl}`)
			return


		// 创建一个 <g> 元素来替换 <use>。
		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

		// --- 属性迁移 ---
		// 1. 迁移位置属性：<use> 的 x/y 等同于在 transform 前应用 translate。
		const x = parseFloat(useEl.getAttribute('x') || 0)
		const y = parseFloat(useEl.getAttribute('y') || 0)
		let transform = useEl.getAttribute('transform') || ''
		if (x !== 0 || y !== 0)
			transform = `translate(${x}, ${y}) ${transform}`

		if (transform) g.setAttribute('transform', transform.trim())

		// 2. 迁移样式相关属性：这些属性会由 <g> 继承给其子元素。
		const attrsToCopy = [
			'class', 'style', 'fill', 'fill-opacity', 'stroke',
			'stroke-width', 'stroke-linecap', 'stroke-linejoin',
			'opacity', 'color'
		]
		attrsToCopy.forEach(attr => {
			if (useEl.hasAttribute(attr))
				g.setAttribute(attr, useEl.getAttribute(attr))

		})

		// --- 内容克隆 ---
		// <symbol> 元素本身不可见，需将其内容提取出来。
		// 注意：这简化了 `viewBox` 的处理，对于需要裁剪的复杂符号可能不完美。
		if (targetElement.tagName === 'symbol')
			Array.from(targetElement.childNodes).forEach(child => {
				g.appendChild(child.cloneNode(true))
			})
		else
			g.appendChild(targetElement.cloneNode(true))

		if (useEl.parentNode) {
			useEl.parentNode.replaceChild(g, useEl)
			// 递归处理，新插入的内容里可能还包含 <use> 标签。
			await expandUseElements(g, nextBaseUrl, maxDepth - 1)
		}
	}))
}

/**
 * 为 SVG 元素内的所有路径计算并应用动态的动画属性。
 * @private
 * @param {SVGElement} svgElement - 需要处理的 SVG DOM 元素。
 * @param {{animationDuration: number, lineThickness: number}} config - 动画参数配置。
 * @returns {void}
 */
function addDynamicPathAttributes(svgElement, config) {
	const paths = svgElement.querySelectorAll('path')
	if (paths.length === 0) return

	const pathLengths = []
	/** @type {{el: SVGPathElement, len: number}[]} */
	const validPaths = []

	paths.forEach(path => {
		// 忽略 <defs> 中的路径定义。
		if (path.closest('defs')) return

		try {
			const len = path.getTotalLength()
			// 过滤掉长度过小的无效路径。
			if (len > 0.1) {
				pathLengths.push(len)
				validPaths.push({ el: path, len })
			}
		} catch (e) {
			// 忽略无法计算长度的路径。
		}
	})

	if (pathLengths.length === 0) return

	const maxLength = Math.max(...pathLengths)
	const minLength = Math.min(...pathLengths)

	validPaths.forEach(({ el: path, len: totalLength }, index) => {
		const relativeLength = totalLength / maxLength
		// 补偿算法：让短路径稍微慢一点，长路径稍微快一点，使动画在视觉上更统一。
		const lengthCompensation = (minLength / maxLength) / relativeLength * (0.7 - minLength / maxLength)
		const pathAnimationDuration = (relativeLength + lengthCompensation) * (0.7 * config.animationDuration)

		path.style.strokeDasharray = totalLength
		path.style.strokeDashoffset = totalLength
		path.style.animationDelay = `${index / validPaths.length}s`
		path.style.animationDuration = `${pathAnimationDuration}s`

		// 强制初始填充透明，防止在绘制动画期间显示原始填充色。
		path.style.fillOpacity = '0'
	})
}

/**
 * 将动画所需的 CSS 样式（@keyframes）注入到 SVG 的 <defs> 部分。
 * @private
 * @param {SVGElement} svgElement - 需要注入样式的 SVG DOM 元素。
 * @param {{animationDuration: number, lineThickness: number}} config - 动画参数配置。
 * @returns {void}
 */
function insertAnimationStyles(svgElement, config) {
	let defsTag = svgElement.querySelector('defs')
	if (!defsTag)
		svgElement.insertBefore(defsTag = document.createElementNS('http://www.w3.org/2000/svg', 'defs'), svgElement.firstChild)

	let styleTag = defsTag.querySelector('style')
	if (!styleTag)
		defsTag.appendChild(styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style'))

	if (styleTag.textContent.includes('@keyframes')) return

	const styleHTML = `
.animate-svg path {
	animation: animate-svg-draw ease-in-out forwards, animate-svg-fill ease-in-out forwards;
	stroke: currentColor;
	stroke-linecap: round;
	stroke-linejoin: round;
}

@keyframes animate-svg-draw {
	100% {
		stroke-dashoffset: 0;
	}
}

@keyframes animate-svg-fill {
	0%, 60% {
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
 * 核心功能：为给定的 SVG 元素应用并触发绘制动画。
 * @param {SVGElement} svgElement - 要添加动画的 SVG DOM 元素。
 * @param {AnimateSVGOptions} [options] - 可选的配置项。
 * @returns {Promise<SVGElement>} - 返回被修改后的 SVG 元素。
 */
export async function animateSVG(svgElement, options = {}) {
	const config = {
		animationDuration: 3,
		lineThickness: 0.5,
		basePath: document.baseURI || window.location.href,
		...options
	}

	if (!(svgElement instanceof SVGElement)) throw new Error('animateSVG: 提供的参数不是一个有效的 SVG 元素。')

	// 1. 递归展开所有 <use> 标签，此步会修改 svgElement 的内部 DOM。
	await expandUseElements(svgElement, config.basePath)

	// 2. 为所有实际存在的 path 计算动画参数。
	addDynamicPathAttributes(svgElement, config)

	// 3. 注入 CSS 动画定义。
	insertAnimationStyles(svgElement, config)

	// 4. 添加 class 来触发动画。
	if (!svgElement.classList.contains('animate-svg')) {
		svgElement.classList.add('animate-svg')

		// 动画结束后进行清理，恢复 SVG 的原始状态。
		setTimeout(() => {
			svgElement.classList.remove('animate-svg')
			if (svgElement.getAttribute('class') === '')
				svgElement.removeAttribute('class')

			svgElement.querySelectorAll('path').forEach(p => {
				p.style.removeProperty('fill-opacity')
				p.style.removeProperty('stroke-dasharray')
				p.style.removeProperty('stroke-dashoffset')
				p.style.removeProperty('animation-delay')
				p.style.removeProperty('animation-duration')
			})

		}, config.animationDuration * 1000)
	}

	return svgElement
}

/**
 * 将一个带有内嵌动画的 SVG 元素导出为 .svg 字符串。
 * @param {SVGElement} svgElement - 要导出的 SVG DOM 元素。
 * @param {AnimateSVGOptions} [options] - 配置项，同 animateSVG。
 * @returns {Promise<string>} - 返回导出的 SVG 字符串。
 */
export async function exportAnimatedSVG(svgElement, options = {}) {
	const config = {
		animationDuration: 3,
		lineThickness: 0.5,
		basePath: document.baseURI || window.location.href,
		...options
	}

	if (!(svgElement instanceof SVGElement)) throw new Error('exportAnimatedSVG: 提供的参数不是一个有效的 SVG 元素。')

	// 1. 克隆节点以避免修改页面上原始的 SVG 元素。
	const svgToExport = svgElement.cloneNode(true)

	// 2. 递归展开 <use> 标签 (必须在计算路径之前，因为 <use> 展开后会变成 <path>)
	await expandUseElements(svgToExport, config.basePath)

	// 3. 为所有路径计算长度并应用内联样式
	addDynamicPathAttributes(svgToExport, config)

	// 4. 添加 class 和注入 CSS
	svgToExport.classList.add('animate-svg')
	insertAnimationStyles(svgToExport, config)

	// 5. 包装并输出
	const container = document.createElement('div')
	container.appendChild(svgToExport)

	return container.innerHTML
}
