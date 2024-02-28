// Vimesh UI v0.12.4
"use strict";

(function (G) {
    if (G.$vui) return // Vimesh UI core is already loaded

    G.$vui = {
        config: { debug: false },
        ready(callback) {
            if (G.Alpine) {
                callback()
            } else {
                document.addEventListener('alpine:init', callback)
            }
        }
    }
    const initAt = new Date()
    const _ = G.$vui._ = {
        elapse() {
            return new Date() - initAt
        },
        isString(str) {
            return (str != null && typeof str.valueOf() === "string")
        },
        isArray(array) {
            return Array.isArray(array)
        },
        isFunction(func) {
            return typeof func === "function";
        },
        isPlainObject(item) {
            return item !== null && typeof item === 'object' && item.constructor === Object;
        },
        each(objOrArray, callback) {
            if (!objOrArray) return
            if (_.isArray(objOrArray)) {
                objOrArray.forEach((val, index) => {
                    callback(val, index, index)
                })
            } else {
                Object.entries(objOrArray).forEach(([key, val], index) => {
                    callback(val, key, index)
                })
            }
        },
        map(objOrArray, callback) {
            let result = []
            _.each(objOrArray, (val, key, index) => result.push(callback(val, key, index)))
            return result
        },
        filter(objOrArray, callback) {
            let result = []
            _.each(objOrArray, (val, key, index) => callback(val, key, index) && result.push(val))
            return result
        },
        extend(target, ...sources) {
            const length = sources.length
            if (length < 1 || target == null) return target
            for (let i = 0; i < length; i++) {
                const source = sources[i]
                if (!_.isPlainObject(source)) continue
                Object.keys(source).forEach((key) => {
                    var desc = Object.getOwnPropertyDescriptor(source, key)
                    if (desc.get || desc.set) {
                        Object.defineProperty(target, key, desc);
                    } else {
                        target[key] = source[key]
                    }
                })
            }
            return target
        }
    }
})(window);;if (!$vui.setups) $vui.setups = {}
if (!$vui.components) $vui.components = {}
$vui.ready(() => {
    const _ = $vui._
    const { directive, prefixed, addRootSelector, magic,
        closestDataStack, mergeProxies, initTree, mutateDom, reactive } = Alpine
    const ATTR_UI = 'v-ui'
    const ATTR_CLOAK = 'v-cloak'
    const DEFAULT_NAMESPACE = 'vui'

    const DIR_COMP = prefixed('component')
    const DIR_IMPORT = prefixed('import')
    const DIR_DATA = prefixed('data')
    const DIR_INIT = prefixed('init')
    const DIR_IGNORE = prefixed('ignore')
    const allNamespaces = [DEFAULT_NAMESPACE]

    let styleElement = document.createElement('style')
    styleElement.setAttribute('id', 'vimesh-ui-component-common-styles')
    styleElement.innerHTML = `
    [${ATTR_UI}] {display : block}
    [${ATTR_CLOAK}] {display: none !important;}
    `
    document.head.prepend(styleElement)
    function addNamespace(ns) {
        if (!ns) return
        ns = ns.trim()
        if (allNamespaces.indexOf(ns) === -1)
            allNamespaces.push(ns)
    }
    function getNamespaceFromXcomponent(dirName) {
        let p1 = dirName.indexOf(':')
        if (p1 === -1) return DEFAULT_NAMESPACE
        let p2 = dirName.indexOf('.', p1)
        return p2 === -1 ? dirName.substring(p1 + 1) : dirName.substring(p1 + 1, p2)
    }
    function isComponent(el) {
        if (el._vui_type) return true
        if (el.tagName) {
            let p = el.tagName.indexOf('-')
            if (p === -1) return false
            let ns = el.tagName.substring(0, p).toLowerCase()
            if (allNamespaces.indexOf(ns) !== -1) {
                return true
            }
        }
        return false
    }
    function getParentComponent(el) {
        if (!el.parentNode) return null
        if (isComponent(el.parentNode)) return el.parentNode
        return getParentComponent(el.parentNode)
    }
    function visitComponents(elContainer, callback) {
        if (elContainer.tagName === 'TEMPLATE') {
            if (elContainer._x_teleport) {
                if (isComponent(elContainer._x_teleport)) callback(elContainer._x_teleport)
                return visitComponents(elContainer._x_teleport, callback)
            }
            return visitComponents(elContainer.content, callback)
        }
        _.each(elContainer.querySelectorAll('*'), el => {
            if (isComponent(el)) callback(el)
            if (el.tagName === 'TEMPLATE') {
                if (el._x_teleport) {
                    if (isComponent(el._x_teleport)) callback(el._x_teleport)
                    return visitComponents(el._x_teleport, callback)
                }
                return visitComponents(el.content, callback)
            }
        })
    }
    function findClosestComponent(el, filter) {
        if (!el) return null
        if (el._vui_type) {
            if (_.isString(filter)) {
                let type = filter
                filter = (el) => el._vui_type === type
            }
            if (!filter || filter(el)) return el
        }
        if (el._x_teleportBack) {
            return findClosestComponent(el._x_teleportBack.parentNode, filter)
        }
        return findClosestComponent(el.parentNode, filter)
    }
    function normalizeFilter(filter, defNamespace) {
        if (_.isFunction(filter)) return filter
        if (_.isPlainObject(filter)) {
            return (el) => {
                if (el._vui_type !== filter.type) return false
                if (filter.namespace && el._vui_namespace !== filter.namespace) return false
                return true
            }
        } else {
            let namespace = ''
            let type = filter
            let parts = filter.split(':')
            if (parts.length > 1) {
                namespace = parts[0] || defNamespace
                type = parts[1]
            }
            return (el) => {
                if (el._vui_type !== type) return false
                if (namespace && el._vui_namespace !== namespace) return false
                return true
            }
        }

    }
    function getApiOf(el, filter) {
        const comp = findClosestComponent(el, filter)
        if (!comp) return null
        const baseApis = {
            $of(type) {
                if (!type) return null
                return getApiOf(
                    (comp._x_teleportBack || comp).parentNode, normalizeFilter(type, comp._vui_namespace))
            },
            get $meta() { return getComponentMeta(comp) },
            get $parent() { return getParentComponent(comp) },
            $closest(filter) {
                return findClosestComponent(comp, normalizeFilter(filter, comp._vui_namespace))
            },
            $find(filter) {
                return findChildComponents(comp, normalizeFilter(filter, comp._vui_namespace))
            },
            $findOne(filter) {
                let comps = findChildComponents(comp, normalizeFilter(filter, comp._vui_namespace))
                return comps.length > 0 ? comps[0] : null
            }
        }
        return mergeProxies([baseApis, comp._vui_api || {}, ...closestDataStack(comp)])
    }
    function getComponentMeta(el) {
        return {
            type: el._vui_type,
            namespace: el._vui_namespace
        }
    }
    function findChildComponents(elContainer, filter) {
        if (_.isString(filter)) {
            let type = filter
            filter = (el) => el._vui_type === type
        }
        let result = []
        visitComponents(elContainer, (el) => {
            if (!filter || filter(el))
                result.push(el)
        })
        return result
    }
    $vui.addNamespace = addNamespace
    $vui.getComponentMeta = getComponentMeta
    $vui.isComponent = isComponent
    $vui.visitComponents = visitComponents
    $vui.findChildComponents = findChildComponents
    $vui.getParentComponent = getParentComponent
    $vui.findClosestComponent = findClosestComponent
    $vui.$api = (el) => getApiOf(el)
    $vui.$data = Alpine.$data
    $vui.setHtml = (el, html) => {
        el.innerHTML = ''
        let dom = $vui.dom(html)
        if (_.isArray(dom))
            el.append(...dom)
        else
            el.append(dom)
    }
    $vui.defer = (callback) => {
        queueMicrotask(callback)
    }
    $vui.dom = (html) => {
        const elTemp = document.createElement('div')
        elTemp._x_ignore = true
        elTemp.innerHTML = html
        $vui.extractNamespaces(elTemp)
        $vui.prepareComponents(elTemp)
        return elTemp.childNodes.length === 1 ? elTemp.firstChild : [...elTemp.childNodes]
    }
    $vui.nextTick = Alpine.nextTick
    $vui.effect = Alpine.effect
    $vui.focus = (el, options) => el && el.focus && el.focus(options || { preventScroll: true })
    $vui.scrollIntoView = (el, options) => el && el.scrollIntoView && el.scrollIntoView(options || { block: 'nearest' })
    $vui.extractNamespaces = (elContainer) => {
        _.each([elContainer, ...elContainer.querySelectorAll('*')], el => {
            if (el.tagName === 'TEMPLATE') {
                $vui.extractNamespaces(el.content)
            }
            _.each(el.attributes, attr => {
                let name = attr.name
                if (name.startsWith(DIR_COMP)) {
                    let ns = getNamespaceFromXcomponent(name)
                    addNamespace(ns)
                } else if (name.startsWith(DIR_IMPORT) && attr.value) {
                    let comps = attr.value.trim()
                    if (comps.startsWith('[') && comps.endsWith(']')) {
                        //comps = evaluate(el, attr.value)
                        return
                    } else {
                        comps = comps.split(';')
                    }
                    _.each(comps, comp => {
                        let p = comp.indexOf(':')
                        if (p !== -1) {
                            let ns = comp.substring(0, p)
                            addNamespace(ns)
                        }
                    })
                }
            })
        })
    }
    $vui.prepareComponents = (elContainer) => {
        visitComponents(elContainer, el => {
            el.setAttribute(ATTR_CLOAK, '')
            el.setAttribute(DIR_IGNORE, '')
        })
    }
    _.each($vui.config.importMap, (v, k) => {
        if (k !== '*') $vui.addNamespace(k)
    })
    $vui.extractNamespaces(document)
    $vui.prepareComponents(document)
    addRootSelector(() => `[${DIR_COMP}]`)
    magic('api', el => getApiOf(el))
    magic('prop', el => {
        return (name, fallback) => {
            let comp = findClosestComponent(el)
            if (!comp) return null
            return Alpine.bound(comp, name, fallback)
        }
    })

    directive('shtml', (el, { expression }, { effect, evaluateLater }) => {
        let evaluate = evaluateLater(expression)
        effect(() => {
            evaluate(value => {
                $vui.setHtml(el, value)
            })
        })
    })

    directive('component', (el, { expression, value, modifiers }, { cleanup }) => {
        if (el.tagName.toLowerCase() !== 'template') {
            return console.warn('x-component can only be used on a <template> tag', el)
        }
        const namespace = value || $vui.config.namespace || DEFAULT_NAMESPACE
        const compName = `${namespace}-${expression}`
        const unwrap = modifiers.includes('unwrap')
        const elScript = el.content.querySelector("script")
        if (elScript) {
            const elExecute = document.createElement("script")
            _.each(elScript.attributes, a => elExecute.setAttribute(a.name, a.value))
            elExecute.setAttribute('component', compName)
            elExecute.innerHTML = `
$vui.setups["${compName}"] = ($el)=>{
${elScript.innerHTML}
}
//# sourceURL=__vui__/${compName}.js
`
            document.body.append(elExecute)
            elScript.remove()
        }
        function copyAttributes(elFrom, elTo) {
            _.each(elFrom.attributes, attr => {
                if (DIR_COMP === attr.name || attr.name.startsWith(DIR_COMP)) return
                try {
                    let name = attr.name
                    if (name.startsWith('@'))
                        name = `${prefixed('on')}:${name.substring(1)}`
                    else if (name.startsWith(':'))
                        name = `${prefixed('bind')}:${name.substring(1)}`
                    if (DIR_INIT === name && elTo.getAttribute(DIR_INIT)) {
                        elTo.setAttribute(name, attr.value + ';' + elTo.getAttribute(DIR_INIT))
                    } else if (DIR_DATA === name && elTo.getAttribute(DIR_DATA)) {
                        elTo.setAttribute(name, '{...' + attr.value + ',...' + elTo.getAttribute(DIR_DATA) + '}')
                    } else if ('class' === name) {
                        elTo.setAttribute(name, attr.value + ' ' + (elTo.getAttribute('class') || ''))
                    } else if (!elTo.hasAttribute(name)) {
                        elTo.setAttribute(name, attr.value)
                    }
                } catch (ex) {
                    console.warn(`Fails to set attribute ${attr.name}=${attr.value} in ${elTo.tagName.toLowerCase()}`)
                }
            })
        }

        function interpolateTemplate(template, args) {
            const templ = Object.entries(args).reduce(
                (result, [arg, val]) => result.replaceAll(`$\{${arg}}`, `${val}`), template);
            const pattern = /\$\{[^}]+\}/g;
            return templ.replace(pattern, '{}');
        }

        function extractAttributes(element) {
            const attributes = element.attributes;
            const result = {};
            for (let i = 0; i < attributes.length; i++) {
                const attribute = attributes[i];
                if (attribute.name.startsWith('_')) {
                    result[attribute.name] = attribute.value;
                }
            }
            return result;
        }

        $vui.components[compName] = class extends HTMLElement {
            connectedCallback() {
                let elComp = this
                let elTopComp = getParentComponent(elComp)
                while (elTopComp) {
                    if (!elTopComp.hasAttribute(ATTR_UI) && !elTopComp._vui_type) {
                        if ($vui.config.debug) console.log('Not ready to connect ' + this.tagName)
                        return
                    }
                    elTopComp = getParentComponent(elTopComp)
                }
                elComp.setAttribute(ATTR_UI, $vui.config.debug ? `${_.elapse()}` : '')
                if ($vui.config.debug) console.log('Connect ' + this.tagName)
                mutateDom(() => {
                    const slotContents = {}
                    const defaultSlotContent = []
                    _.each(this.childNodes, elChild => {
                        if (elChild.tagName && elChild.hasAttribute('slot')) {
                            let slotName = elChild.getAttribute('slot') || ''
                            let content = elChild.tagName === 'TEMPLATE' ?
                                elChild.content.cloneNode(true).childNodes :
                                [elChild.cloneNode(true)]
                            if (slotContents[slotName])
                                slotContents[slotName].push(...content)
                            else
                                slotContents[slotName] = content
                        } else {
                            defaultSlotContent.push(elChild.cloneNode(true))
                        }
                    })

                    // Interpolate template - replace ${_attributeName} with attribute value
                    el.innerHTML = interpolateTemplate(el.innerHTML, extractAttributes(this));

                    if (unwrap) {
                        elComp = el.content.cloneNode(true).firstElementChild
                        copyAttributes(this, elComp)
                        this.after(elComp)
                        this.remove()
                    } else {
                        elComp.innerHTML = el.innerHTML
                    }
                    copyAttributes(el, elComp)

                    const elSlots = elComp.querySelectorAll("slot")
                    _.each(elSlots, elSlot => {
                        const name = elSlot.getAttribute('name') || ''
                        elSlot.after(...(slotContents[name] ? slotContents[name] : defaultSlotContent))
                        elSlot.remove()
                    })
                    if (unwrap && isComponent(elComp)) return

                    elComp._vui_type = expression
                    elComp._vui_namespace = namespace
                    let setup = $vui.setups[compName]
                    if (setup) {
                        elComp._vui_api = reactive(setup(elComp))
                    }
                    if (!elComp.hasAttribute(DIR_DATA))
                        elComp.setAttribute(DIR_DATA, '{}')

                    let elParentComp = getParentComponent(elComp)
                    if (!elParentComp || elParentComp._vui_type) {
                        queueMicrotask(() => {
                            if (!elComp.isConnected) return
                            elComp.removeAttribute(ATTR_CLOAK)
                            elComp.removeAttribute(DIR_IGNORE)
                            delete elComp._x_ignore
                            if ($vui.config.debug) console.log('Process initTree ' + this.tagName)
                            initTree(elComp)
                            if (elComp._vui_api) {
                                let api = getApiOf(elComp)
                                if (api.onMounted) api.onMounted()
                            }
                            _.each(elComp._vui_deferred_elements, el => {
                                if (el._vui_api) {
                                    let api = getApiOf(el)
                                    if (api.onMounted) api.onMounted()
                                }
                            })
                            delete elComp._vui_deferred_elements
                        })
                    } else {
                        // wait for parent component to be mounted
                        if ($vui.config.debug) console.log('Defer initTree ' + this.tagName)
                        if (!elParentComp._vui_deferred_elements)
                            elParentComp._vui_deferred_elements = []
                        elParentComp._vui_deferred_elements.push(elComp)
                        if (elComp._vui_deferred_elements)
                            elParentComp._vui_deferred_elements.push(...elComp._vui_deferred_elements)
                        queueMicrotask(() => {
                            elComp.removeAttribute(ATTR_CLOAK)
                            elComp.removeAttribute(DIR_IGNORE)
                            delete elComp._x_ignore
                        })
                    }
                })
            }
            disconnectedCallback() {
                if ($vui.config.debug) console.log((this.hasAttribute(ATTR_UI) ? 'Disconnect ' : 'Not ready to disconnect ') + this.tagName)

                if (this._vui_api) {
                    let api = getApiOf(this)
                    if (api.onUnmounted) api.onUnmounted()
                }
            }
            attributeChangedCallback(name, oldValue, newValue) {
                if (this._vui_api) {
                    let api = getApiOf(this)
                    if (api.onAttributeChanged) api.onAttributeChanged(name, oldValue, newValue)
                }
            }
        }
        customElements.define(compName.toLowerCase(), $vui.components[compName]);
    })
});$vui.import = (comps) => {
    if (!comps) return
    const _ = $vui._
    const importMap = $vui.config.importMap
    //if (!importMap || !importMap['*'])
    //    return Promise.reject('You must setup import url template for the fallback namespace "*"')

    if (!$vui.imports) $vui.imports = {}
    if (!$vui.importScriptIndex) $vui.importScriptIndex = 1
    if (_.isString(comps)) comps = [comps]
    if (_.isArray(comps)) {
        const tasks = []
        _.each(comps, comp => {
            if (!comp) return
            let fullname = comp = comp.trim()
            let urlTpl = importMap['*']
            let url = null
            let namespace = ''
            let pos = comp.indexOf(':')
            if (pos !== -1) {
                namespace = comp.substring(0, pos)
                comp = comp.substring(pos + 1)
                if (namespace) $vui.addNamespace(namespace)
            }
            pos = comp.lastIndexOf('/')
            let path = ''
            if (pos !== -1) {
                path = comp.substring(0, pos + 1)
                comp = comp.substring(pos + 1)
            }
            _.each(comp.split(','), component => {
                component = component.trim()
                let compInfo = { path, namespace, component, fullname: `${namespace ? namespace + ':' : ''}${path}${component}` }
                if (compInfo.namespace && importMap[compInfo.namespace])
                    urlTpl = importMap[compInfo.namespace]
                if (!urlTpl){
                    return console.error(`Url template for namespace '${compInfo.namespace}' is not defined!`)
                }
                try {
                    const parse = new Function("data", "with (data){return `" + urlTpl + "`}")
                    url = parse(compInfo)
                } catch (ex) {
                    console.error(`Fails to parse url template ${urlTpl} with component ${comp}`)
                    return
                }
                if (url && !$vui.imports[url]) {
                    let importMeta = { url, ...compInfo }
                    $vui.imports[url] = importMeta
                    tasks.push(fetch(url).then(r => {
                        if (!r.ok) throw Error(`${r.status} (${r.statusText})`)
                        return r.text()
                    }).then(html => {
                        const el = document.createElement('div')
                        el._x_ignore = true
                        el.innerHTML = html
                        importMeta.html = html
                        let all = [...el.childNodes]
                        return new Promise((resolve) => {
                            const process = (i) => {
                                if (i < all.length) {
                                    const elChild = all[i]
                                    elChild.remove()
                                    if (elChild.tagName === 'LINK') {
                                        document.head.append(elChild)
                                        process(i + 1)
                                    } else if (elChild.tagName === 'SCRIPT') {
                                        if (elChild.hasAttribute('use-meta')) {
                                            elChild.innerHTML = `const __import_meta__ = ${JSON.stringify(importMeta)}\r\n` + elChild.innerHTML
                                        }
                                        const elExecute = document.createElement("script")
                                        const wait = elChild.src && !elChild.async
                                        if (wait) {
                                            elExecute.onload = () => {
                                                process(i + 1)
                                            }
                                            elExecute.onerror = () => {
                                                console.error(`Fails to load script from "${elExecute.src}"`)
                                                process(i + 1)
                                            }
                                        }
                                        _.each(elChild.attributes, a => elExecute.setAttribute(a.name, a.value))
                                        if (!elChild.src) {
                                            let file = `__vui__/scripts/js_${$vui.importScriptIndex}.js`
                                            elExecute.setAttribute('file', file)
                                            elExecute.innerHTML = `${elChild.innerHTML}\r\n//# sourceURL=${file}`
                                            $vui.importScriptIndex++
                                        }
                                        document.body.append(elExecute)
                                        if (!wait) process(i + 1)
                                    } else if (elChild.tagName === 'TEMPLATE') {
                                        $vui.extractNamespaces(elChild)
                                        $vui.prepareComponents(elChild)
                                        document.body.append(elChild)
                                        process(i + 1)
                                    } else {
                                        process(i + 1)
                                    }
                                } else {
                                    if ($vui.config.debug)
                                        console.log(`Imported ${fullname} @ ${url}`)
                                    resolve()
                                }
                            }
                            process(0)
                        })
                    }).catch(ex => {
                        console.error(`Fails to import ${fullname} @ ${url}`, ex)
                    }))
                }
            })
        })
        return Promise.all(tasks)
    } else {
        return Promise.reject(`Fails to import ${comps} !`)
    }
}
$vui.ready(() => {
    const _ = $vui._
    const { directive, prefixed, addRootSelector } = Alpine
    addRootSelector(() => `[${prefixed('import')}]`)
    directive('import', (el, { expression, value }, { effect, evaluateLater }) => {
        if (!expression) return
        if (value) {
            if (value === 'dynamic' || value === 'dyn') {
                let evaluate = evaluateLater(expression)
                effect(() => evaluate(val => $vui.import(val)))
            } else {
                console.error(`${prefixed('import')}:${value} is not allowed!`)
            }
        } else {
            $vui.import(expression.split(';'))
        }
    })
});$vui.include = (elHost, urls) => {
    const _ = $vui._
    const unwrap = elHost._vui_unwrap
    let baseUrl
    for (let elCurrent = elHost; elCurrent; elCurrent = elCurrent.parentElement) {
        baseUrl = elCurrent._vui_base_url
        if (baseUrl) break
    }
    if (!baseUrl)
        baseUrl = document.baseURI
    if (_.isArray(urls)) {
        const tasks = []
        _.each(urls, url => {
            url = url.trim()
            if (url) {
                let fullUrl = new URL(url, baseUrl).href
                tasks.push(fetch(fullUrl).then(r => r.text()).then(html => {
                    const el = document.createElement('div')
                    el._x_ignore = true
                    el.innerHTML = html
                    let all = [...el.childNodes]
                    return new Promise((resolve) => {
                        const process = (i) => {
                            if (i < all.length) {
                                const elChild = all[i]
                                elChild.remove()
                                if (elChild.tagName === 'SCRIPT') {
                                    const elExecute = document.createElement("script")
                                    const wait = elChild.src && !elChild.async
                                    if (wait) {
                                        elExecute.onload = () => {
                                            process(i + 1)
                                        }
                                        elExecute.onerror = () => {
                                            console.error(`Fails to load script from "${elExecute.src}"`)
                                            process(i + 1)
                                        }
                                    }
                                    _.each(elChild.attributes, a => elExecute.setAttribute(a.name, a.value))
                                    if (!elChild.src) {
                                        let file = `__vui__/scripts/js_${$vui.importScriptIndex}.js`
                                        elExecute.setAttribute('file', file)
                                        elExecute.innerHTML = `${elChild.innerHTML}\r\n//From ${url}\r\n//# sourceURL=${file}`
                                        $vui.importScriptIndex++
                                    }
                                    document.body.append(elExecute)
                                    if (!wait) process(i + 1)
                                } else {
                                    elChild._vui_base_url = fullUrl
                                    if (unwrap) {
                                        elHost.before(elChild)
                                    } else {
                                        elHost.append(elChild)
                                    }
                                    process(i + 1)
                                }
                            } else {
                                if ($vui.config.debug)
                                    console.log(`Included ${url}`)
                                if (unwrap) elHost.remove()
                                resolve()
                            }
                        }
                        process(0)
                    })
                }).catch(ex => {
                    console.error(`Fails to include ${comp} @ ${url}`, ex)
                }))
            }
        })
        return Promise.all(tasks)
    } else {
        return Promise.reject(`Fails to include ${urls} !`)
    }
}
$vui.ready(() => {
    const _ = $vui._
    const { directive, prefixed, addRootSelector } = Alpine
    addRootSelector(() => `[${prefixed('include')}]`)
    directive('include', (el, { expression, modifiers }, { effect, evaluateLater }) => {
        if (!expression) return
        el._vui_unwrap = modifiers.includes('unwrap')
        let urls = expression.trim()
        if (urls.startsWith('.') || urls.startsWith('/') || urls.startsWith('http://') || urls.startsWith('https://')) {
            $vui.include(el, [urls])
        } else {
            let evaluate = evaluateLater(expression)
            effect(() => evaluate(value => {
                if (_.isArray(value)) {
                    $vui.include(el, value)
                } else if (_.isString(value)) {
                    $vui.include(el, [value])
                } else {
                    $vui.include(el, [urls])
                }
            }))
        }
    })
});(() => {
  // node_modules/tabbable/dist/index.esm.js
  var candidateSelectors = ["input", "select", "textarea", "a[href]", "button", "[tabindex]:not(slot)", "audio[controls]", "video[controls]", '[contenteditable]:not([contenteditable="false"])', "details>summary:first-of-type", "details"];
  var candidateSelector = /* @__PURE__ */ candidateSelectors.join(",");
  var NoElement = typeof Element === "undefined";
  var matches = NoElement ? function() {
  } : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
  var getRootNode = !NoElement && Element.prototype.getRootNode ? function(element) {
    return element.getRootNode();
  } : function(element) {
    return element.ownerDocument;
  };
  var getCandidates = function getCandidates2(el, includeContainer, filter) {
    var candidates = Array.prototype.slice.apply(el.querySelectorAll(candidateSelector));
    if (includeContainer && matches.call(el, candidateSelector)) {
      candidates.unshift(el);
    }
    candidates = candidates.filter(filter);
    return candidates;
  };
  var getCandidatesIteratively = function getCandidatesIteratively2(elements, includeContainer, options) {
    var candidates = [];
    var elementsToCheck = Array.from(elements);
    while (elementsToCheck.length) {
      var element = elementsToCheck.shift();
      if (element.tagName === "SLOT") {
        var assigned = element.assignedElements();
        var content = assigned.length ? assigned : element.children;
        var nestedCandidates = getCandidatesIteratively2(content, true, options);
        if (options.flatten) {
          candidates.push.apply(candidates, nestedCandidates);
        } else {
          candidates.push({
            scope: element,
            candidates: nestedCandidates
          });
        }
      } else {
        var validCandidate = matches.call(element, candidateSelector);
        if (validCandidate && options.filter(element) && (includeContainer || !elements.includes(element))) {
          candidates.push(element);
        }
        var shadowRoot = element.shadowRoot || // check for an undisclosed shadow
        typeof options.getShadowRoot === "function" && options.getShadowRoot(element);
        var validShadowRoot = !options.shadowRootFilter || options.shadowRootFilter(element);
        if (shadowRoot && validShadowRoot) {
          var _nestedCandidates = getCandidatesIteratively2(shadowRoot === true ? element.children : shadowRoot.children, true, options);
          if (options.flatten) {
            candidates.push.apply(candidates, _nestedCandidates);
          } else {
            candidates.push({
              scope: element,
              candidates: _nestedCandidates
            });
          }
        } else {
          elementsToCheck.unshift.apply(elementsToCheck, element.children);
        }
      }
    }
    return candidates;
  };
  var getTabindex = function getTabindex2(node, isScope) {
    if (node.tabIndex < 0) {
      if ((isScope || /^(AUDIO|VIDEO|DETAILS)$/.test(node.tagName) || node.isContentEditable) && isNaN(parseInt(node.getAttribute("tabindex"), 10))) {
        return 0;
      }
    }
    return node.tabIndex;
  };
  var sortOrderedTabbables = function sortOrderedTabbables2(a, b) {
    return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
  };
  var isInput = function isInput2(node) {
    return node.tagName === "INPUT";
  };
  var isHiddenInput = function isHiddenInput2(node) {
    return isInput(node) && node.type === "hidden";
  };
  var isDetailsWithSummary = function isDetailsWithSummary2(node) {
    var r = node.tagName === "DETAILS" && Array.prototype.slice.apply(node.children).some(function(child) {
      return child.tagName === "SUMMARY";
    });
    return r;
  };
  var getCheckedRadio = function getCheckedRadio2(nodes, form) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].checked && nodes[i].form === form) {
        return nodes[i];
      }
    }
  };
  var isTabbableRadio = function isTabbableRadio2(node) {
    if (!node.name) {
      return true;
    }
    var radioScope = node.form || getRootNode(node);
    var queryRadios = function queryRadios2(name) {
      return radioScope.querySelectorAll('input[type="radio"][name="' + name + '"]');
    };
    var radioSet;
    if (typeof window !== "undefined" && typeof window.CSS !== "undefined" && typeof window.CSS.escape === "function") {
      radioSet = queryRadios(window.CSS.escape(node.name));
    } else {
      try {
        radioSet = queryRadios(node.name);
      } catch (err) {
        console.error("Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s", err.message);
        return false;
      }
    }
    var checked = getCheckedRadio(radioSet, node.form);
    return !checked || checked === node;
  };
  var isRadio = function isRadio2(node) {
    return isInput(node) && node.type === "radio";
  };
  var isNonTabbableRadio = function isNonTabbableRadio2(node) {
    return isRadio(node) && !isTabbableRadio(node);
  };
  var isZeroArea = function isZeroArea2(node) {
    var _node$getBoundingClie = node.getBoundingClientRect(), width = _node$getBoundingClie.width, height = _node$getBoundingClie.height;
    return width === 0 && height === 0;
  };
  var isHidden = function isHidden2(node, _ref) {
    var displayCheck = _ref.displayCheck, getShadowRoot = _ref.getShadowRoot;
    if (getComputedStyle(node).visibility === "hidden") {
      return true;
    }
    var isDirectSummary = matches.call(node, "details>summary:first-of-type");
    var nodeUnderDetails = isDirectSummary ? node.parentElement : node;
    if (matches.call(nodeUnderDetails, "details:not([open]) *")) {
      return true;
    }
    var nodeRootHost = getRootNode(node).host;
    var nodeIsAttached = (nodeRootHost === null || nodeRootHost === void 0 ? void 0 : nodeRootHost.ownerDocument.contains(nodeRootHost)) || node.ownerDocument.contains(node);
    if (!displayCheck || displayCheck === "full") {
      if (typeof getShadowRoot === "function") {
        var originalNode = node;
        while (node) {
          var parentElement = node.parentElement;
          var rootNode = getRootNode(node);
          if (parentElement && !parentElement.shadowRoot && getShadowRoot(parentElement) === true) {
            return isZeroArea(node);
          } else if (node.assignedSlot) {
            node = node.assignedSlot;
          } else if (!parentElement && rootNode !== node.ownerDocument) {
            node = rootNode.host;
          } else {
            node = parentElement;
          }
        }
        node = originalNode;
      }
      if (nodeIsAttached) {
        return !node.getClientRects().length;
      }
    } else if (displayCheck === "non-zero-area") {
      return isZeroArea(node);
    }
    return false;
  };
  var isDisabledFromFieldset = function isDisabledFromFieldset2(node) {
    if (/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(node.tagName)) {
      var parentNode = node.parentElement;
      while (parentNode) {
        if (parentNode.tagName === "FIELDSET" && parentNode.disabled) {
          for (var i = 0; i < parentNode.children.length; i++) {
            var child = parentNode.children.item(i);
            if (child.tagName === "LEGEND") {
              return matches.call(parentNode, "fieldset[disabled] *") ? true : !child.contains(node);
            }
          }
          return true;
        }
        parentNode = parentNode.parentElement;
      }
    }
    return false;
  };
  var isNodeMatchingSelectorFocusable = function isNodeMatchingSelectorFocusable2(options, node) {
    if (node.disabled || isHiddenInput(node) || isHidden(node, options) || // For a details element with a summary, the summary element gets the focus
    isDetailsWithSummary(node) || isDisabledFromFieldset(node)) {
      return false;
    }
    return true;
  };
  var isNodeMatchingSelectorTabbable = function isNodeMatchingSelectorTabbable2(options, node) {
    if (isNonTabbableRadio(node) || getTabindex(node) < 0 || !isNodeMatchingSelectorFocusable(options, node)) {
      return false;
    }
    return true;
  };
  var isValidShadowRootTabbable = function isValidShadowRootTabbable2(shadowHostNode) {
    var tabIndex = parseInt(shadowHostNode.getAttribute("tabindex"), 10);
    if (isNaN(tabIndex) || tabIndex >= 0) {
      return true;
    }
    return false;
  };
  var sortByOrder = function sortByOrder2(candidates) {
    var regularTabbables = [];
    var orderedTabbables = [];
    candidates.forEach(function(item, i) {
      var isScope = !!item.scope;
      var element = isScope ? item.scope : item;
      var candidateTabindex = getTabindex(element, isScope);
      var elements = isScope ? sortByOrder2(item.candidates) : element;
      if (candidateTabindex === 0) {
        isScope ? regularTabbables.push.apply(regularTabbables, elements) : regularTabbables.push(element);
      } else {
        orderedTabbables.push({
          documentOrder: i,
          tabIndex: candidateTabindex,
          item,
          isScope,
          content: elements
        });
      }
    });
    return orderedTabbables.sort(sortOrderedTabbables).reduce(function(acc, sortable) {
      sortable.isScope ? acc.push.apply(acc, sortable.content) : acc.push(sortable.content);
      return acc;
    }, []).concat(regularTabbables);
  };
  var tabbable = function tabbable2(el, options) {
    options = options || {};
    var candidates;
    if (options.getShadowRoot) {
      candidates = getCandidatesIteratively([el], options.includeContainer, {
        filter: isNodeMatchingSelectorTabbable.bind(null, options),
        flatten: false,
        getShadowRoot: options.getShadowRoot,
        shadowRootFilter: isValidShadowRootTabbable
      });
    } else {
      candidates = getCandidates(el, options.includeContainer, isNodeMatchingSelectorTabbable.bind(null, options));
    }
    return sortByOrder(candidates);
  };
  var focusable = function focusable2(el, options) {
    options = options || {};
    var candidates;
    if (options.getShadowRoot) {
      candidates = getCandidatesIteratively([el], options.includeContainer, {
        filter: isNodeMatchingSelectorFocusable.bind(null, options),
        flatten: true,
        getShadowRoot: options.getShadowRoot
      });
    } else {
      candidates = getCandidates(el, options.includeContainer, isNodeMatchingSelectorFocusable.bind(null, options));
    }
    return candidates;
  };
  var isTabbable = function isTabbable2(node, options) {
    options = options || {};
    if (!node) {
      throw new Error("No node provided");
    }
    if (matches.call(node, candidateSelector) === false) {
      return false;
    }
    return isNodeMatchingSelectorTabbable(options, node);
  };
  var focusableCandidateSelector = /* @__PURE__ */ candidateSelectors.concat("iframe").join(",");
  var isFocusable = function isFocusable2(node, options) {
    options = options || {};
    if (!node) {
      throw new Error("No node provided");
    }
    if (matches.call(node, focusableCandidateSelector) === false) {
      return false;
    }
    return isNodeMatchingSelectorFocusable(options, node);
  };

  // node_modules/focus-trap/dist/focus-trap.esm.js
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      enumerableOnly && (symbols = symbols.filter(function(sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = null != arguments[i] ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), true).forEach(function(key) {
        _defineProperty(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function(key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
    return target;
  }
  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  var activeFocusTraps = function() {
    var trapQueue = [];
    return {
      activateTrap: function activateTrap(trap) {
        if (trapQueue.length > 0) {
          var activeTrap = trapQueue[trapQueue.length - 1];
          if (activeTrap !== trap) {
            activeTrap.pause();
          }
        }
        var trapIndex = trapQueue.indexOf(trap);
        if (trapIndex === -1) {
          trapQueue.push(trap);
        } else {
          trapQueue.splice(trapIndex, 1);
          trapQueue.push(trap);
        }
      },
      deactivateTrap: function deactivateTrap(trap) {
        var trapIndex = trapQueue.indexOf(trap);
        if (trapIndex !== -1) {
          trapQueue.splice(trapIndex, 1);
        }
        if (trapQueue.length > 0) {
          trapQueue[trapQueue.length - 1].unpause();
        }
      }
    };
  }();
  var isSelectableInput = function isSelectableInput2(node) {
    return node.tagName && node.tagName.toLowerCase() === "input" && typeof node.select === "function";
  };
  var isEscapeEvent = function isEscapeEvent2(e) {
    return e.key === "Escape" || e.key === "Esc" || e.keyCode === 27;
  };
  var isTabEvent = function isTabEvent2(e) {
    return e.key === "Tab" || e.keyCode === 9;
  };
  var delay = function delay2(fn) {
    return setTimeout(fn, 0);
  };
  var findIndex = function findIndex2(arr, fn) {
    var idx = -1;
    arr.every(function(value, i) {
      if (fn(value)) {
        idx = i;
        return false;
      }
      return true;
    });
    return idx;
  };
  var valueOrHandler = function valueOrHandler2(value) {
    for (var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      params[_key - 1] = arguments[_key];
    }
    return typeof value === "function" ? value.apply(void 0, params) : value;
  };
  var getActualTarget = function getActualTarget2(event) {
    return event.target.shadowRoot && typeof event.composedPath === "function" ? event.composedPath()[0] : event.target;
  };
  var createFocusTrap = function createFocusTrap2(elements, userOptions) {
    var doc = (userOptions === null || userOptions === void 0 ? void 0 : userOptions.document) || document;
    var config = _objectSpread2({
      returnFocusOnDeactivate: true,
      escapeDeactivates: true,
      delayInitialFocus: true
    }, userOptions);
    var state = {
      // containers given to createFocusTrap()
      // @type {Array<HTMLElement>}
      containers: [],
      // list of objects identifying tabbable nodes in `containers` in the trap
      // NOTE: it's possible that a group has no tabbable nodes if nodes get removed while the trap
      //  is active, but the trap should never get to a state where there isn't at least one group
      //  with at least one tabbable node in it (that would lead to an error condition that would
      //  result in an error being thrown)
      // @type {Array<{
      //   container: HTMLElement,
      //   tabbableNodes: Array<HTMLElement>, // empty if none
      //   focusableNodes: Array<HTMLElement>, // empty if none
      //   firstTabbableNode: HTMLElement|null,
      //   lastTabbableNode: HTMLElement|null,
      //   nextTabbableNode: (node: HTMLElement, forward: boolean) => HTMLElement|undefined
      // }>}
      containerGroups: [],
      // same order/length as `containers` list
      // references to objects in `containerGroups`, but only those that actually have
      //  tabbable nodes in them
      // NOTE: same order as `containers` and `containerGroups`, but __not necessarily__
      //  the same length
      tabbableGroups: [],
      nodeFocusedBeforeActivation: null,
      mostRecentlyFocusedNode: null,
      active: false,
      paused: false,
      // timer ID for when delayInitialFocus is true and initial focus in this trap
      //  has been delayed during activation
      delayInitialFocusTimer: void 0
    };
    var trap;
    var getOption = function getOption2(configOverrideOptions, optionName, configOptionName) {
      return configOverrideOptions && configOverrideOptions[optionName] !== void 0 ? configOverrideOptions[optionName] : config[configOptionName || optionName];
    };
    var findContainerIndex = function findContainerIndex2(element) {
      return state.containerGroups.findIndex(function(_ref) {
        var container = _ref.container, tabbableNodes = _ref.tabbableNodes;
        return container.contains(element) || // fall back to explicit tabbable search which will take into consideration any
        //  web components if the `tabbableOptions.getShadowRoot` option was used for
        //  the trap, enabling shadow DOM support in tabbable (`Node.contains()` doesn't
        //  look inside web components even if open)
        tabbableNodes.find(function(node) {
          return node === element;
        });
      });
    };
    var getNodeForOption = function getNodeForOption2(optionName) {
      var optionValue = config[optionName];
      if (typeof optionValue === "function") {
        for (var _len2 = arguments.length, params = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          params[_key2 - 1] = arguments[_key2];
        }
        optionValue = optionValue.apply(void 0, params);
      }
      if (optionValue === true) {
        optionValue = void 0;
      }
      if (!optionValue) {
        if (optionValue === void 0 || optionValue === false) {
          return optionValue;
        }
        throw new Error("`".concat(optionName, "` was specified but was not a node, or did not return a node"));
      }
      var node = optionValue;
      if (typeof optionValue === "string") {
        node = doc.querySelector(optionValue);
        if (!node) {
          throw new Error("`".concat(optionName, "` as selector refers to no known node"));
        }
      }
      return node;
    };
    var getInitialFocusNode = function getInitialFocusNode2() {
      var node = getNodeForOption("initialFocus");
      if (node === false) {
        return false;
      }
      if (node === void 0) {
        if (findContainerIndex(doc.activeElement) >= 0) {
          node = doc.activeElement;
        } else {
          var firstTabbableGroup = state.tabbableGroups[0];
          var firstTabbableNode = firstTabbableGroup && firstTabbableGroup.firstTabbableNode;
          node = firstTabbableNode || getNodeForOption("fallbackFocus");
        }
      }
      if (!node) {
        throw new Error("Your focus-trap needs to have at least one focusable element");
      }
      return node;
    };
    var updateTabbableNodes = function updateTabbableNodes2() {
      state.containerGroups = state.containers.map(function(container) {
        var tabbableNodes = tabbable(container, config.tabbableOptions);
        var focusableNodes = focusable(container, config.tabbableOptions);
        return {
          container,
          tabbableNodes,
          focusableNodes,
          firstTabbableNode: tabbableNodes.length > 0 ? tabbableNodes[0] : null,
          lastTabbableNode: tabbableNodes.length > 0 ? tabbableNodes[tabbableNodes.length - 1] : null,
          /**
           * Finds the __tabbable__ node that follows the given node in the specified direction,
           *  in this container, if any.
           * @param {HTMLElement} node
           * @param {boolean} [forward] True if going in forward tab order; false if going
           *  in reverse.
           * @returns {HTMLElement|undefined} The next tabbable node, if any.
           */
          nextTabbableNode: function nextTabbableNode(node) {
            var forward = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
            var nodeIdx = focusableNodes.findIndex(function(n) {
              return n === node;
            });
            if (nodeIdx < 0) {
              return void 0;
            }
            if (forward) {
              return focusableNodes.slice(nodeIdx + 1).find(function(n) {
                return isTabbable(n, config.tabbableOptions);
              });
            }
            return focusableNodes.slice(0, nodeIdx).reverse().find(function(n) {
              return isTabbable(n, config.tabbableOptions);
            });
          }
        };
      });
      state.tabbableGroups = state.containerGroups.filter(function(group) {
        return group.tabbableNodes.length > 0;
      });
      if (state.tabbableGroups.length <= 0 && !getNodeForOption("fallbackFocus")) {
        throw new Error("Your focus-trap must have at least one container with at least one tabbable node in it at all times");
      }
    };
    var tryFocus = function tryFocus2(node) {
      if (node === false) {
        return;
      }
      if (node === doc.activeElement) {
        return;
      }
      if (!node || !node.focus) {
        tryFocus2(getInitialFocusNode());
        return;
      }
      node.focus({
        preventScroll: !!config.preventScroll
      });
      state.mostRecentlyFocusedNode = node;
      if (isSelectableInput(node)) {
        node.select();
      }
    };
    var getReturnFocusNode = function getReturnFocusNode2(previousActiveElement) {
      var node = getNodeForOption("setReturnFocus", previousActiveElement);
      return node ? node : node === false ? false : previousActiveElement;
    };
    var checkPointerDown = function checkPointerDown2(e) {
      var target = getActualTarget(e);
      if (findContainerIndex(target) >= 0) {
        return;
      }
      if (valueOrHandler(config.clickOutsideDeactivates, e)) {
        trap.deactivate({
          // if, on deactivation, we should return focus to the node originally-focused
          //  when the trap was activated (or the configured `setReturnFocus` node),
          //  then assume it's also OK to return focus to the outside node that was
          //  just clicked, causing deactivation, as long as that node is focusable;
          //  if it isn't focusable, then return focus to the original node focused
          //  on activation (or the configured `setReturnFocus` node)
          // NOTE: by setting `returnFocus: false`, deactivate() will do nothing,
          //  which will result in the outside click setting focus to the node
          //  that was clicked, whether it's focusable or not; by setting
          //  `returnFocus: true`, we'll attempt to re-focus the node originally-focused
          //  on activation (or the configured `setReturnFocus` node)
          returnFocus: config.returnFocusOnDeactivate && !isFocusable(target, config.tabbableOptions)
        });
        return;
      }
      if (valueOrHandler(config.allowOutsideClick, e)) {
        return;
      }
      e.preventDefault();
    };
    var checkFocusIn = function checkFocusIn2(e) {
      var target = getActualTarget(e);
      var targetContained = findContainerIndex(target) >= 0;
      if (targetContained || target instanceof Document) {
        if (targetContained) {
          state.mostRecentlyFocusedNode = target;
        }
      } else {
        e.stopImmediatePropagation();
        tryFocus(state.mostRecentlyFocusedNode || getInitialFocusNode());
      }
    };
    var checkTab = function checkTab2(e) {
      var target = getActualTarget(e);
      updateTabbableNodes();
      var destinationNode = null;
      if (state.tabbableGroups.length > 0) {
        var containerIndex = findContainerIndex(target);
        var containerGroup = containerIndex >= 0 ? state.containerGroups[containerIndex] : void 0;
        if (containerIndex < 0) {
          if (e.shiftKey) {
            destinationNode = state.tabbableGroups[state.tabbableGroups.length - 1].lastTabbableNode;
          } else {
            destinationNode = state.tabbableGroups[0].firstTabbableNode;
          }
        } else if (e.shiftKey) {
          var startOfGroupIndex = findIndex(state.tabbableGroups, function(_ref2) {
            var firstTabbableNode = _ref2.firstTabbableNode;
            return target === firstTabbableNode;
          });
          if (startOfGroupIndex < 0 && (containerGroup.container === target || isFocusable(target, config.tabbableOptions) && !isTabbable(target, config.tabbableOptions) && !containerGroup.nextTabbableNode(target, false))) {
            startOfGroupIndex = containerIndex;
          }
          if (startOfGroupIndex >= 0) {
            var destinationGroupIndex = startOfGroupIndex === 0 ? state.tabbableGroups.length - 1 : startOfGroupIndex - 1;
            var destinationGroup = state.tabbableGroups[destinationGroupIndex];
            destinationNode = destinationGroup.lastTabbableNode;
          }
        } else {
          var lastOfGroupIndex = findIndex(state.tabbableGroups, function(_ref3) {
            var lastTabbableNode = _ref3.lastTabbableNode;
            return target === lastTabbableNode;
          });
          if (lastOfGroupIndex < 0 && (containerGroup.container === target || isFocusable(target, config.tabbableOptions) && !isTabbable(target, config.tabbableOptions) && !containerGroup.nextTabbableNode(target))) {
            lastOfGroupIndex = containerIndex;
          }
          if (lastOfGroupIndex >= 0) {
            var _destinationGroupIndex = lastOfGroupIndex === state.tabbableGroups.length - 1 ? 0 : lastOfGroupIndex + 1;
            var _destinationGroup = state.tabbableGroups[_destinationGroupIndex];
            destinationNode = _destinationGroup.firstTabbableNode;
          }
        }
      } else {
        destinationNode = getNodeForOption("fallbackFocus");
      }
      if (destinationNode) {
        e.preventDefault();
        tryFocus(destinationNode);
      }
    };
    var checkKey = function checkKey2(e) {
      if (isEscapeEvent(e) && valueOrHandler(config.escapeDeactivates, e) !== false) {
        e.preventDefault();
        trap.deactivate();
        return;
      }
      if (isTabEvent(e)) {
        checkTab(e);
        return;
      }
    };
    var checkClick = function checkClick2(e) {
      var target = getActualTarget(e);
      if (findContainerIndex(target) >= 0) {
        return;
      }
      if (valueOrHandler(config.clickOutsideDeactivates, e)) {
        return;
      }
      if (valueOrHandler(config.allowOutsideClick, e)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    var addListeners = function addListeners2() {
      if (!state.active) {
        return;
      }
      activeFocusTraps.activateTrap(trap);
      state.delayInitialFocusTimer = config.delayInitialFocus ? delay(function() {
        tryFocus(getInitialFocusNode());
      }) : tryFocus(getInitialFocusNode());
      doc.addEventListener("focusin", checkFocusIn, true);
      doc.addEventListener("mousedown", checkPointerDown, {
        capture: true,
        passive: false
      });
      doc.addEventListener("touchstart", checkPointerDown, {
        capture: true,
        passive: false
      });
      doc.addEventListener("click", checkClick, {
        capture: true,
        passive: false
      });
      doc.addEventListener("keydown", checkKey, {
        capture: true,
        passive: false
      });
      return trap;
    };
    var removeListeners = function removeListeners2() {
      if (!state.active) {
        return;
      }
      doc.removeEventListener("focusin", checkFocusIn, true);
      doc.removeEventListener("mousedown", checkPointerDown, true);
      doc.removeEventListener("touchstart", checkPointerDown, true);
      doc.removeEventListener("click", checkClick, true);
      doc.removeEventListener("keydown", checkKey, true);
      return trap;
    };
    trap = {
      get active() {
        return state.active;
      },
      get paused() {
        return state.paused;
      },
      activate: function activate(activateOptions) {
        if (state.active) {
          return this;
        }
        var onActivate = getOption(activateOptions, "onActivate");
        var onPostActivate = getOption(activateOptions, "onPostActivate");
        var checkCanFocusTrap = getOption(activateOptions, "checkCanFocusTrap");
        if (!checkCanFocusTrap) {
          updateTabbableNodes();
        }
        state.active = true;
        state.paused = false;
        state.nodeFocusedBeforeActivation = doc.activeElement;
        if (onActivate) {
          onActivate();
        }
        var finishActivation = function finishActivation2() {
          if (checkCanFocusTrap) {
            updateTabbableNodes();
          }
          addListeners();
          if (onPostActivate) {
            onPostActivate();
          }
        };
        if (checkCanFocusTrap) {
          checkCanFocusTrap(state.containers.concat()).then(finishActivation, finishActivation);
          return this;
        }
        finishActivation();
        return this;
      },
      deactivate: function deactivate(deactivateOptions) {
        if (!state.active) {
          return this;
        }
        var options = _objectSpread2({
          onDeactivate: config.onDeactivate,
          onPostDeactivate: config.onPostDeactivate,
          checkCanReturnFocus: config.checkCanReturnFocus
        }, deactivateOptions);
        clearTimeout(state.delayInitialFocusTimer);
        state.delayInitialFocusTimer = void 0;
        removeListeners();
        state.active = false;
        state.paused = false;
        activeFocusTraps.deactivateTrap(trap);
        var onDeactivate = getOption(options, "onDeactivate");
        var onPostDeactivate = getOption(options, "onPostDeactivate");
        var checkCanReturnFocus = getOption(options, "checkCanReturnFocus");
        var returnFocus = getOption(options, "returnFocus", "returnFocusOnDeactivate");
        if (onDeactivate) {
          onDeactivate();
        }
        var finishDeactivation = function finishDeactivation2() {
          delay(function() {
            if (returnFocus) {
              tryFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation));
            }
            if (onPostDeactivate) {
              onPostDeactivate();
            }
          });
        };
        if (returnFocus && checkCanReturnFocus) {
          checkCanReturnFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation)).then(finishDeactivation, finishDeactivation);
          return this;
        }
        finishDeactivation();
        return this;
      },
      pause: function pause() {
        if (state.paused || !state.active) {
          return this;
        }
        state.paused = true;
        removeListeners();
        return this;
      },
      unpause: function unpause() {
        if (!state.paused || !state.active) {
          return this;
        }
        state.paused = false;
        updateTabbableNodes();
        addListeners();
        return this;
      },
      updateContainerElements: function updateContainerElements(containerElements) {
        var elementsAsArray = [].concat(containerElements).filter(Boolean);
        state.containers = elementsAsArray.map(function(element) {
          return typeof element === "string" ? doc.querySelector(element) : element;
        });
        if (state.active) {
          updateTabbableNodes();
        }
        return this;
      }
    };
    trap.updateContainerElements(elements);
    return trap;
  };

  // packages/focus/src/index.js
  function src_default(Alpine) {
    let lastFocused;
    let currentFocused;
    window.addEventListener("focusin", () => {
      lastFocused = currentFocused;
      currentFocused = document.activeElement;
    });
    Alpine.magic("focus", (el) => {
      let within = el;
      return {
        __noscroll: false,
        __wrapAround: false,
        within(el2) {
          within = el2;
          return this;
        },
        withoutScrolling() {
          this.__noscroll = true;
          return this;
        },
        noscroll() {
          this.__noscroll = true;
          return this;
        },
        withWrapAround() {
          this.__wrapAround = true;
          return this;
        },
        wrap() {
          return this.withWrapAround();
        },
        focusable(el2) {
          return isFocusable(el2);
        },
        previouslyFocused() {
          return lastFocused;
        },
        lastFocused() {
          return lastFocused;
        },
        focused() {
          return currentFocused;
        },
        focusables() {
          if (Array.isArray(within))
            return within;
          return focusable(within, { displayCheck: "none" });
        },
        all() {
          return this.focusables();
        },
        isFirst(el2) {
          let els = this.all();
          return els[0] && els[0].isSameNode(el2);
        },
        isLast(el2) {
          let els = this.all();
          return els.length && els.slice(-1)[0].isSameNode(el2);
        },
        getFirst() {
          return this.all()[0];
        },
        getLast() {
          return this.all().slice(-1)[0];
        },
        getNext() {
          let list = this.all();
          let current = document.activeElement;
          if (list.indexOf(current) === -1)
            return;
          if (this.__wrapAround && list.indexOf(current) === list.length - 1) {
            return list[0];
          }
          return list[list.indexOf(current) + 1];
        },
        getPrevious() {
          let list = this.all();
          let current = document.activeElement;
          if (list.indexOf(current) === -1)
            return;
          if (this.__wrapAround && list.indexOf(current) === 0) {
            return list.slice(-1)[0];
          }
          return list[list.indexOf(current) - 1];
        },
        first() {
          this.focus(this.getFirst());
        },
        last() {
          this.focus(this.getLast());
        },
        next() {
          this.focus(this.getNext());
        },
        previous() {
          this.focus(this.getPrevious());
        },
        prev() {
          return this.previous();
        },
        focus(el2) {
          if (!el2)
            return;
          setTimeout(() => {
            if (!el2.hasAttribute("tabindex"))
              el2.setAttribute("tabindex", "0");
            el2.focus({ preventScroll: this._noscroll });
          });
        }
      };
    });
    Alpine.directive("trap", Alpine.skipDuringClone(
      (el, { expression, modifiers }, { effect, evaluateLater, cleanup }) => {
        let evaluator = evaluateLater(expression);
        let oldValue = false;
        let options = {
          escapeDeactivates: false,
          allowOutsideClick: true,
          fallbackFocus: () => el
        };
        if (modifiers.includes("noautofocus")) {
          options.initialFocus = false;
        } else {
          let autofocusEl = el.querySelector("[autofocus]");
          if (autofocusEl)
            options.initialFocus = autofocusEl;
        }
        let trap = createFocusTrap(el, options);
        let undoInert = () => {
        };
        let undoDisableScrolling = () => {
        };
        const releaseFocus = () => {
          undoInert();
          undoInert = () => {
          };
          undoDisableScrolling();
          undoDisableScrolling = () => {
          };
          trap.deactivate({
            returnFocus: !modifiers.includes("noreturn")
          });
        };
        effect(() => evaluator((value) => {
          if (oldValue === value)
            return;
          if (value && !oldValue) {
            if (modifiers.includes("noscroll"))
              undoDisableScrolling = disableScrolling();
            if (modifiers.includes("inert"))
              undoInert = setInert(el);
            setTimeout(() => {
              trap.activate();
            }, 15);
          }
          if (!value && oldValue) {
            releaseFocus();
          }
          oldValue = !!value;
        }));
        cleanup(releaseFocus);
      },
      // When cloning, we only want to add aria-hidden attributes to the
      // DOM and not try to actually trap, as trapping can mess with the
      // live DOM and isn't just isolated to the cloned DOM.
      (el, { expression, modifiers }, { evaluate }) => {
        if (modifiers.includes("inert") && evaluate(expression))
          setInert(el);
      }
    ));
  }
  function setInert(el) {
    let undos = [];
    crawlSiblingsUp(el, (sibling) => {
      let cache = sibling.hasAttribute("aria-hidden");
      sibling.setAttribute("aria-hidden", "true");
      undos.push(() => cache || sibling.removeAttribute("aria-hidden"));
    });
    return () => {
      while (undos.length)
        undos.pop()();
    };
  }
  function crawlSiblingsUp(el, callback) {
    if (el.isSameNode(document.body) || !el.parentNode)
      return;
    Array.from(el.parentNode.children).forEach((sibling) => {
      if (sibling.isSameNode(el)) {
        crawlSiblingsUp(el.parentNode, callback);
      } else {
        callback(sibling);
      }
    });
  }
  function disableScrolling() {
    let overflow = document.documentElement.style.overflow;
    let paddingRight = document.documentElement.style.paddingRight;
    let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.documentElement.style.overflow = overflow;
      document.documentElement.style.paddingRight = paddingRight;
    };
  }

  // packages/focus/builds/cdn.js
  document.addEventListener("alpine:init", () => {
    window.Alpine.plugin(src_default);
  });
})();
/*! Bundled license information:

tabbable/dist/index.esm.js:
  (*!
  * tabbable 5.3.3
  * @license MIT, https://github.com/focus-trap/tabbable/blob/master/LICENSE
  *)

focus-trap/dist/focus-trap.esm.js:
  (*!
  * focus-trap 6.9.4
  * @license MIT, https://github.com/focus-trap/focus-trap/blob/master/LICENSE
  *)
*/
