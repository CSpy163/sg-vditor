/**
 * 操作栈对象
 */
class SgItemNode {
    prevNode;
    nextNode;
    /**
     * 操作类型
     * create <-> delete
     * modify <-> modify
     */
    mode;
    // 快照
    capture;
    // 结束快照
    captureEnd;

    constructor(captureEnd) {
        this.captureEnd = captureEnd;
    }

    setNext(nextNode) {
        this.nextNode = nextNode;
        nextNode.prevNode = this;
    }
}

class SgVditor {

    /**
     * 记录当前活动
     */
    mySvg = null;
    mySvgSize = {
        x: 0, y: 0,
        width: 0,
        height: 0
    };
    viewBox = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };

    // create / delete / modify
    mode = "";
    /**
     * 当前鼠标类型
     * select: 当前为选中模式
     * [图形]: 绘图模式
     */
    type = "line";
    /**
     * 当前操作的对象，一般为鼠标按钮点下时的 e.target
     */
    obj = null;
    /**
     * 现有把手，用于维护编辑状态的所有对象。
     */
    handlers = [];
    // /**
    //  * 用于记录 x 轴坐标
    //  * 绘图时：用作记录原点
    //  * 拖动时：可以复用为上一次移动的点
    //  */
    // startX = 0;
    // /**
    //  * 用于记录 y 轴坐标
    //  * 绘图时：用作记录原点
    //  * 拖动时：可以复用为上一次移动的点
    //  */
    // startY = 0;

    /**
     * 记录鼠标按下状态
     */
    mousePressed = false;
    /**
     * 记录鼠标按下后，是否移动过，单次按压有效
     */
    mousePressingMove = false;
    /**
     * 操作栈
     * 对象指向头节点
     */
    nodeLinkList = null;
    /**
     * 当前操作节点
     */
    currentNode = null;
    /**
     * 临时快照
     */
    capture = null;


    /**
     * 将 Node 添加到操作栈中
     */
    addNodeToLinkList(newCurrent) {
        if (this.currentNode) {
            this.currentNode.setNext(newCurrent);
        }
        // 如果没有头节点
        if (!this.nodeLinkList) {
            this.nodeLinkList = newCurrent;
        }
        this.currentNode = newCurrent;
    }

    /**
     * 撤销
     */
    undo() {
        // console.log("撤销")
        if (this.currentNode) {
            this.clearHandlers();
            switch (this.currentNode.mode) {
                case "create":
                    for (let obj of this.currentNode.captureEnd) {
                        this.mySvg.removeChild(this.mySvg.querySelector(`#${obj.getAttribute("id")}`));
                    }
                    break;
                case "delete":
                    for (let obj of this.currentNode.capture) {
                        this.mySvg.appendChild(obj);
                    }
                    break;
                case "modify":
                    for (let obj of this.currentNode.captureEnd) {
                        this.mySvg.removeChild(this.mySvg.querySelector(`#${obj.getAttribute("id")}`));
                    }
                    for (let obj of this.currentNode.capture) {
                        this.mySvg.appendChild(obj);
                    }
                    break;
                default:
            }
            this.currentNode = this.currentNode.prevNode;
        }
    }

    /**
     * 反撤销
     */
    undoRemoveNode() {
        if (this.currentNode) {
            if (this.currentNode.nextNode) {
                this.currentNode = this.currentNode.nextNode;
            } else {
                return;
            }
        } else {
            if (this.nodeLinkList) {
                this.currentNode = this.nodeLinkList;
            }
        }
        if (this.currentNode) {
            this.clearHandlers();
            switch (this.currentNode.mode) {
                case "create":
                    for (let obj of this.currentNode.captureEnd) {
                        this.mySvg.appendChild(obj);
                    }
                    break;
                case "delete":
                    for (let obj of this.currentNode.capture) {
                        this.mySvg.removeChild(this.mySvg.querySelector(`#${obj.getAttribute("id")}`));
                    }
                    break;
                case "modify":
                    for (let obj of this.currentNode.capture) {
                        this.mySvg.removeChild(this.mySvg.querySelector(`#${obj.getAttribute("id")}`));
                    }
                    for (let obj of this.currentNode.captureEnd) {
                        this.mySvg.appendChild(obj);
                    }

                    break;
                default:
            }
        }
    }

    /**
     * 判断当前对象是否处于编辑状态
     * @param obj
     * @returns {boolean}
     */
    isEditing(obj) {
        for (let i = 0; i < this.handlers.length; i++) {
            if (this.handlers[i].sgParent === obj) {
                return true;
            }
        }
        return false;
    }

    /**
     * 为当前对象添加把手
     * @param obj
     * @returns {SVGCircleElement}
     */
    addHandlersByObj(obj) {
        let defaultHandler = null;
        let handlers = null;
        switch (obj.getAttribute("type")) {
            case "line":
                handlers = this.createHandlers(obj, 2);
                defaultHandler = handlers[obj.defaultHandler ?? 1];
                break;
            case "rect":
                if (obj.getAttribute("select")) {
                    handlers = this.createHandlers(obj, 8, {hidden: true});
                } else {
                    handlers = this.createHandlers(obj, 8);
                }
                defaultHandler = handlers[obj.defaultHandler ?? 4];
                break;
            case "polygon":
                const pointsStr = obj.getAttribute("points");
                let points = pointsStr.split(" ");
                const handlerOptions = [];
                for (let i = 0; i < points.length; i++) {
                    handlerOptions.push(this.getPointFromStr(points[i]))
                }
                handlers = this.createHandlersBySpecific(obj, handlerOptions);
                defaultHandler = handlers[0];
                break;
        }
        this.clearHandlers();
        this.handlers.push(...handlers);
        this.updateHandlersByObj(obj);
        return defaultHandler;
    }

    /**
     * 清空所有对象编辑状态
     */
    clearHandlers() {
        if (this.handlers) {
            this.handlers.forEach(h => this.mySvg.removeChild(h));
            this.handlers.splice(0);
        }
    }

    /**
     * 以当前把手所指对象创建快照
     * @returns {*[]}
     */
    takeCapture() {
        // 当前编辑对象快照
        const captures = []
        if (this.handlers) {
            new Set(this.handlers.map((h) => h.sgParent)).forEach((obj) => {
                captures.push(obj.cloneNode(true));
            });
        }
        return captures;
    }

    /**
     * 重置 this.myHand 状态，一般用于鼠标点击之后
     */
    resetHand() {
        this.mode = "";
        if (this.type !== 'polygon') {
            this.obj = null;
        }
        this.mousePressed = false;
        this.mousePressingMove = false;
        this.capture = null;
    }

    updateHandlersByObj(obj) {
        const handlers = this.handlers.filter((h) => h.sgParent === obj);
        switch (obj.getAttribute("type")) {
            case "line":
                handlers.forEach((h) => {
                    const position = h.getAttribute("handlerPosition");
                    switch (position) {
                        case "0":
                            h.setAttribute("cx", obj.getAttribute("x1"));
                            h.setAttribute("cy", obj.getAttribute("y1"));
                            break;
                        case "1":
                            h.setAttribute("cx", obj.getAttribute("x2"));
                            h.setAttribute("cy", obj.getAttribute("y2"));
                            break;
                    }
                });
                break;
            case "rect":
                const ox = parseFloat(obj.getAttribute("x"));
                const oy = parseFloat(obj.getAttribute("y"));
                const oWidth = parseFloat(obj.getAttribute("width"));
                const oHeight = parseFloat(obj.getAttribute("height"));
                handlers.forEach((h) => {
                    const position = h.getAttribute("handlerPosition");
                    switch (position) {
                        case "0":
                            h.setAttribute("cx", ox);
                            h.setAttribute("cy", oy);
                            break;
                        case "1":
                            h.setAttribute("cx", ox + oWidth / 2);
                            h.setAttribute("cy", oy);
                            break;
                        case "2":
                            h.setAttribute("cx", ox + oWidth);
                            h.setAttribute("cy", oy);
                            break;
                        case "3":
                            h.setAttribute("cx", ox + oWidth);
                            h.setAttribute("cy", oy + oHeight / 2);
                            break;
                        case "4":
                            h.setAttribute("cx", ox + oWidth);
                            h.setAttribute("cy", oy + oHeight);
                            break;
                        case "5":
                            h.setAttribute("cx", ox + oWidth / 2);
                            h.setAttribute("cy", oy + oHeight);
                            break;
                        case "6":
                            h.setAttribute("cx", ox);
                            h.setAttribute("cy", oy + oHeight);
                            break;
                        case "7":
                            h.setAttribute("cx", ox);
                            h.setAttribute("cy", oy + oHeight / 2);
                            break;
                    }
                });
                break;
        }
    }

    offsetObjTo(obj, offsetX, offsetY) {
        switch (obj.getAttribute("type")) {
            case "line":
                obj.setAttribute("x1", parseFloat(obj.getAttribute("x1")) + offsetX);
                obj.setAttribute("y1", parseFloat(obj.getAttribute("y1")) + offsetY);
                obj.setAttribute("x2", parseFloat(obj.getAttribute("x2")) + offsetX);
                obj.setAttribute("y2", parseFloat(obj.getAttribute("y2")) + offsetY);
                break;
            case "rect":
                obj.setAttribute("x", parseFloat(obj.getAttribute("x")) + offsetX);
                obj.setAttribute("y", parseFloat(obj.getAttribute("y")) + offsetY);
                break;
        }
        this.updateHandlersByObj(obj);
    }

    moveHandlerTo(handler, x, y) {
        const obj = handler.sgParent;
        const position = handler.getAttribute("handlerPosition");
        const cx = parseFloat(handler.getAttribute("cx"));
        const cy = parseFloat(handler.getAttribute("cy"));
        switch (obj.getAttribute("type")) {
            case "line":
                switch (position) {
                    case "0":
                        obj.setAttribute("x1", x);
                        obj.setAttribute("y1", y);
                        break;
                    case "1":
                        obj.setAttribute("x2", x);
                        obj.setAttribute("y2", y);
                        break;
                }
                break;
            case "rect":
                const ox = parseFloat(obj.getAttribute("x"));
                const oy = parseFloat(obj.getAttribute("y"));
                const oWidth = parseFloat(obj.getAttribute("width"));
                const oHeight = parseFloat(obj.getAttribute("height"));
                const offsetX = x - cx;
                const offsetY = y - cy;
                let fWidth = oWidth;
                let fHeight = oHeight;
                switch (position) {
                    case "0":
                        fWidth = oWidth - offsetX;
                        fHeight = oHeight - offsetY;
                        obj.setAttribute("x", x);
                        obj.setAttribute("y", y);
                        break;
                    case "1":
                        fHeight = oHeight - offsetY;
                        obj.setAttribute("y", y);
                        break;
                    case "2":
                        fWidth = oWidth + offsetX;
                        fHeight = oHeight - offsetY;
                        obj.setAttribute("y", y);
                        break;
                    case "3":
                        fWidth = oWidth + offsetX;
                        break;
                    case "4":
                        fWidth = oWidth + offsetX;
                        fHeight = oHeight + offsetY;
                        break;
                    case "5":
                        fHeight = oHeight + offsetY;
                        break;
                    case "6":
                        fWidth = oWidth - offsetX;
                        fHeight = oHeight + offsetY;
                        obj.setAttribute("x", x);
                        break;
                    case "7":
                        fWidth = oWidth - offsetX;
                        obj.setAttribute("x", x);
                        break;
                }
                obj.setAttribute("width", Math.abs(fWidth));
                obj.setAttribute("height", Math.abs(fHeight));
                if (fWidth < 0) {
                    if (fHeight < 0) {
                        switch (position) {
                            case "0":
                                obj.setAttribute("x", ox + oWidth);
                                obj.setAttribute("y", oy + oHeight);
                                break;
                            case "2":
                                obj.setAttribute("x", ox + fWidth);
                                obj.setAttribute("y", oy + oHeight);
                                break;
                            case "4":
                                obj.setAttribute("x", ox + fWidth);
                                obj.setAttribute("y", oy + fHeight);
                                break;
                            case "6":
                                obj.setAttribute("x", ox + oWidth);
                                obj.setAttribute("y", oy + fHeight);
                                break;
                        }
                        this.obj = this.handlers.find((h) => h.sgParent === obj && h.getAttribute("handlerPosition") === rectCornerMap[position]);
                    } else {
                        if (["0", "6", "7"].includes(position)) {
                            obj.setAttribute("x", ox + oWidth);
                        } else if (["2", "3", "4"].includes(position)) {
                            obj.setAttribute("x", ox + fWidth);
                        }
                        this.obj = this.handlers.find((h) => h.sgParent === obj && h.getAttribute("handlerPosition") === rectVMap[position]);
                    }
                } else {
                    if (fHeight < 0) {
                        if (["0", "1", "2"].includes(position)) {
                            obj.setAttribute("y", oy + oHeight);
                        } else if (["4", "5", "6"].includes(position)) {
                            obj.setAttribute("y", oy + fHeight);
                        }
                        this.obj = this.handlers.find((h) => h.sgParent === obj && h.getAttribute("handlerPosition") === rectHMap[position]);
                    }
                }
                break;
            case "polygon":
                handler.setAttribute("cx", x);
                handler.setAttribute("cy", y);
                this.updatePolygonByPoints(handler.sgParent, this.handlers);
                break;

        }
        this.updateHandlersByObj(obj);
    }


    updateViewBox() {
        this.mySvg.setAttribute("viewBox", `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`)
    }

    /**
     * 根据某个点位缩放画布
     *
     * @param svgOffsetX 鼠标事件中的 offsetX
     * @param svgOffsetY 鼠标事件中的 offsetY
     * @param scale 缩放倍率：< 1 缩小比例 / > 1 放大比例
     */
    scaleViewBox(svgOffsetX, svgOffsetY, scale) {
        const {x, y, width, height} = this.viewBox;
        const {width: svgWidth, height: svgHeight} = this.mySvgSize;

        this.viewBox = {
            x: x + (1 - scale) * (svgOffsetX / svgWidth * width),
            y: y + (1 - scale) * (svgOffsetY / svgHeight * height),
            width: width * scale,
            height: height * scale
        }
        this.updateViewBox();
    }


    /**
     * 移动 viewBox
     *
     * @param svgOffsetX 鼠标事件中的 offsetX
     * @param svgOffsetY 鼠标事件中的 offsetY
     */
    moveViewBox(svgOffsetX, svgOffsetY) {
        const {x, y, width, height} = this.viewBox;
        const {width: svgWidth, height: svgHeight} = this.mySvgSize;

        this.viewBox.x = x + svgOffsetX / svgWidth * width;
        this.viewBox.y = y + svgOffsetY / svgHeight * height;
        this.updateViewBox();
    }

    /**
     * 通过鼠标事件中的 offsetX 和 offsetY，转换成 svg 中的坐标（考虑 viewBox 偏移）
     *
     * @param svgOffsetX 鼠标事件中的 offsetX
     * @param svgOffsetY 鼠标事件中的 offsetY
     * @returns {{x: number, y: number}} 最终的 svg 坐标
     */
    svgPositionByViewBox(svgOffsetX, svgOffsetY) {
        const {x, y, width, height} = this.viewBox;
        const {width: svgWidth, height: svgHeight} = this.mySvgSize;

        return {
            x: x + svgOffsetX / svgWidth * width,
            y: y + svgOffsetY / svgHeight * height
        }
    }


    tipSpan = null;

    initTipSpan() {
        this.tipSpan = document.createElement("span");
        this.tipSpan.classList.add("vditorTip")
        const border = this.mySvg.getBoundingClientRect();
        this.tipSpan.style.top = `${border.y + border.height - 22}px`
        this.tipSpan.style.left = `${border.x + 8}px`
        this.mySvg.parentNode.appendChild(this.tipSpan);
        this.updateType();
    }

    updateType(type) {
        this.type = type;
        let typeName = ""
        switch (this.type) {
            case "line":
                typeName = "绘画模式：直线";
                break;
            case "rect":
                typeName = "绘画模式：矩形";
                break;
            case "polygon":
                typeName = "绘画模式：多边形";
                break;
            case "select":
                typeName = "选择模式";
                break;
            default:
                typeName = "无操作";
                break;
        }
        this.tipSpan.innerText = `${typeName}`

    }

    menuClick(code, param) {
        switch (code) {
            case "removePolygonHandler":
                if (this.removeHandlerFromPolygon(param.obj, param.x, param.y)) {
                    this.addHandlersByObj(param.obj);
                }
                break;
            case "addPolygonHandler":
                this.insertHandlerToPolygon(param.obj, param.index, param.x, param.y);
                this.addHandlersByObj(param.obj)
                break;
        }
        this.cleanMenu();
    }

    /**
     * 根据坐标点、菜单项创建菜单
     *
     * @param x 鼠标在屏幕上的 x 轴坐标
     * @param y 鼠标在屏幕上的 y 轴坐标
     * @param menuItems 菜单项配置
     * @returns {HTMLDivElement} 菜单对象
     */
    createMenu({x, y}, menuItems) {
        let menu = document.createElement("div");
        menu.classList.add("vidtorMenu");
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        let menuList = document.createElement("ul");
        menu.appendChild(menuList);

        for (let i = 0; i < menuItems.length; i++) {
            const {label, code, param} = menuItems[i];
            let menuItem = document.createElement("li");
            menuItem.innerText = label;
            menuItem.onclick = () => this.menuClick(code, param)
            menuList.appendChild(menuItem)
        }
        return menu;
    }

    /**
     * 清理菜单及其配置项
     */
    cleanMenu() {
        if (this.contextMenu) {
            // 清理监听器（可能有必要？）
            this.contextMenu.querySelectorAll("li")?.forEach(li => {
                li.onclick = null;
            })
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    contextMenu = null;


    /**
     * 打开菜单
     *
     * @param e 菜单展开事件
     * @param svgPosition svg 中的位置（用于处理图形事件 ）
     */
    openMenu(e, svgPosition) {
        if (this.contextMenu) {
            this.cleanMenu();
        }

        let menuItems = [];

        switch (e.target.getAttribute("type")) {
            case "handler":
                if (e.target.sgParent.getAttribute("type") === "polygon") {
                    menuItems.push({
                        label: "移除节点",
                        code: "removePolygonHandler",
                        param: {
                            obj: e.target.sgParent,
                            x: e.target.getAttribute("cx"),
                            y: e.target.getAttribute("cy")
                        }
                    })
                }
                break;
            case "polygon":
                const handlerResult = this.getInsertHandlerIndex(e.target.getAttribute("points"), svgPosition,
                    parseFloat(e.target.getAttribute("stroke-width")));
                if (handlerResult) {
                    menuItems.push({
                        label: "添加节点",
                        code: "addPolygonHandler",
                        param: {
                            ...handlerResult,
                            obj: e.target
                        }
                    })
                } else {
                }

                break;
        }

        this.contextMenu = this.createMenu({x: e.x, y: e.y}, menuItems);
        if (menuItems.length !== 0) {
            this.mySvg.parentNode.appendChild(this.contextMenu);
        }
    }

    getPointFromStr(pointStr) {
        const splits = pointStr.split(",");
        return {
            x: parseFloat(splits[0]),
            y: parseFloat(splits[1])
        }
    }

    /**
     * 通过多边形点坐标集合和新点位置，获取新插入的把手位置下标，及把手坐标
     *
     * @param pointsStr 多边形的点集合字符串
     * @param point 新点位置
     * @returns {number} 新把手位于把手数组的下标
     */
    getInsertHandlerIndex(pointsStr, point, strokeWidth) {
        let points = pointsStr.split(" ");
        const diffs = []
        for (let i = 0; i < points.length; i++) {
            const pointA = this.getPointFromStr(points[i]);
            const next = i === points.length - 1 ? 0 : i + 1;
            const pointB = this.getPointFromStr(points[next]);
            if (isInRectByPoints({pointA, pointB}, point)) {
                const fx = getFuncBy2Points(pointA, pointB);
                diffs.push(Math.abs(point.y - fx(point.x)));
            } else {
                diffs.push(null);
            }
        }
        const minVal = Math.min(...diffs.filter(d => !!d));
        if (minVal) {
            if (minVal > strokeWidth) {
                return null;
            }
            const index = diffs.lastIndexOf(minVal);
            return {
                index: index,
                value: minVal,
                ...point
            }
        }
        return null;
    }


    /**
     * 使用 handlers 更新多边形
     *
     * @param polygon 多边形对象
     * @param handlers 把手集合
     */
    updatePolygonByPoints(polygon, handlers) {
        const array = [];
        handlers.forEach(handler => {
            array.push(`${handler.getAttribute("cx")},${handler.getAttribute("cy")}`)
        })
        polygon.setAttribute("points", array.join(" "));
    }

    removeHandlerFromPolygon(polygon, x, y) {
        const positionStr = `${x},${y}`
        let points = new Array(...polygon.getAttribute("points").split(" "));
        const index = points.lastIndexOf(positionStr);
        if (index !== -1) {
            points.splice(index, 1);
        }
        if (points.length === 0) {
            polygon.remove();
            this.clearHandlers();
            return false;
        } else {
            polygon.setAttribute("points", points.join(" "));
            return true;
        }
    }

    insertHandlerToPolygon(polygon, index, handlerX, handlerY) {
        const points = new Array(...polygon.getAttribute("points").split(" "));
        const newPoint = `${handlerX},${handlerY}`
        const newArray = [...points.slice(0, index + 1), newPoint]
        if (index < points.length - 1) {
            newArray.push(...points.slice(index + 1))
        }
        polygon.setAttribute("points", newArray.join(" "));
    }


    /**
     * 创建多个 handler
     */
    createHandlers(sgParent, number, option) {
        const handlers = []
        for (let i = 0; i < number; i++) {
            handlers.push(this.createHandler(sgParent, i, option));
        }
        return handlers;
    }

    createHandlersBySpecific(sgParent, handlerOptions) {
        const handlers = []
        for (let i = 0; i < handlerOptions.length; i++) {
            handlers.push(this.createHandler(sgParent, i, handlerOptions[i]))
        }
        return handlers;
    }

    /**
     * 创建“把手”
     */
    createHandler(sgParent, position, option) {
        const x = option?.x ?? 0;
        const y = option?.y ?? 0;
        const handler = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        handler.setAttribute("cx", x);
        handler.setAttribute("cy", y);
        handler.setAttribute("r", "3");
        handler.setAttribute("fill", "white");
        handler.setAttribute("stroke", "black");
        handler.setAttribute("type", "handler")

        // 如果是隐形 handler
        if (option?.hidden) {
            handler.setAttribute("opacity", 0);
            handler.setAttribute("stroke-opacity", 0);
        }
        handler.setAttribute("handlerPosition", position);

        handler.classList.add("handler");
        handler.sgParent = sgParent;
        this.mySvg.appendChild(handler);
        return handler;
    }


    constructor({svg}) {
        let node = null;

        if (typeof svg === "string") {
            node = document.querySelector(svg);
        } else {
            node = svg;
        }
        if (node instanceof SVGElement) {
            this.mySvg = node;

            // 设置这个属性，可以使 svg 监听 keydown / keyup 事件
            this.mySvg.setAttribute("tabindex", 0);

            this.mySvgSize = {
                width: this.mySvg.clientWidth,
                height: this.mySvg.clientHeight
            };
            this.viewBox = {
                x: 0,
                y: 0,
                width: this.mySvg.clientWidth,
                height: this.mySvg.clientHeight
            };
            this.updateViewBox();


            // 创建 tip 标签
            this.initTipSpan();
            this.mySvg.addEventListener('contextmenu', (e) => {
                this.openMenu(e, this.svgPositionByViewBox(e.offsetX, e.offsetY))
                e.preventDefault();
            });

            // 监听鼠标滚轮事件
            this.mySvg.addEventListener("wheel", (e) => {
                // 滚轮向上滚动，deltaY > 0；滚轮向下滚动，deltaY < 0
                const {deltaY, offsetX, offsetY} = e;
                this.scaleViewBox(offsetX, offsetY, deltaY > 0 ? 1.1 : 0.9)
            });

            // 监听键盘松开事件
            this.mySvg.addEventListener("keyup", (e) => {
                if (e.code === "Space") {
                    this.mySvg.style.cursor = 'default'
                    return;
                }
            });

            // 监听键盘按下事件
            this.mySvg.addEventListener("keydown", (e) => {
                if (e.code === "Space") {
                    this.mySvg.style.cursor = 'move'
                    return;
                }
                if (e.ctrlKey) {
                    switch (e.code) {
                        case "KeyZ":
                            this.clearHandlers();
                            if (e.shiftKey) {
                                this.undoRemoveNode();
                            } else {
                                this.undo();
                            }
                            return;
                    }
                }
            })


            // 监听鼠标按下事件
            this.mySvg.addEventListener("mousedown", (e) => {
                // 监听鼠标按下事件，设置 this.myHand
                this.mousePressed = true;
                // this.mousePressingMove = false;
                const {x, y} = this.svgPositionByViewBox(e.offsetX, e.offsetY);
                this.startX = x;
                this.startY = y;

                if (this.type !== 'polygon') {
                    this.obj = e.target;
                }
            });

            // 监听鼠标移动事件
            this.mySvg.addEventListener("mousemove", (e) => {
                const {x, y} = this.svgPositionByViewBox(e.offsetX, e.offsetY);

                if (this.mousePressed) {
                    // 移动画布
                    if (this.mySvg.style.cursor === 'move') {
                        this.moveViewBox(-e.movementX, -e.movementY);
                        return;
                    }
                    // 只处理按下移动事件
                    this.mousePressingMove = true;

                    if (this.obj?.classList.contains("handler")) {
                        if (!this.mode) {
                            // 把当前选中的对象，创建快照
                            this.capture = this.takeCapture();
                            this.mode = "modify";
                        }
                        this.moveHandlerTo(this.obj, x, y)
                    } else {
                        if (this.type) {
                            this.clearHandlers();
                            let option = null;
                            switch (this.type) {
                                case "line":
                                    option = {
                                        x1: this.startX,
                                        y1: this.startY,
                                        x2: x,
                                        y2: y,
                                    }
                                    option.type = 'line';
                                    break;
                                case "rect":
                                    option = correctRect(this.startX, this.startY, x - parseFloat(this.startX), y - parseFloat(this.startY))
                                    option.type = 'rect';
                                    break;
                                case "select":
                                    if (this.obj === this.mySvg) {
                                        option = correctRect(this.startX, this.startY, x - parseFloat(this.startX), y - parseFloat(this.startY));
                                        option.type = 'rect';
                                        option.select = true;
                                    }
                                    break;
                            }
                            if (option) {
                                const drawObj = createObjectBy(option);
                                this.mySvg.appendChild(drawObj);
                                this.mode = option.select ? "select" : "create";
                                this.obj = this.addHandlersByObj(drawObj);
                            }

                        } else {
                            if (this.obj === this.mySvg) {
                                // todo 绘制选区
                            } else {
                                if (!this.isEditing(this.obj)) {
                                    this.clearHandlers();
                                    this.addHandlersByObj(this.obj);
                                }
                                if (this.mode !== "modify") {
                                    // 把当前选中的对象，创建快照
                                    this.capture = this.takeCapture();
                                    this.mode = "modify";
                                }
                                this.offsetObjTo(this.obj, x - this.startX, y - this.startY)
                                this.startX = x;
                                this.startY = y;
                            }
                        }

                    }
                } else {
                    if (this.type === 'polygon' && this.handlers.length !== 0) {
                        if (this.handlers.length === 1) {
                            const handler = this.createHandler(this.handlers[0].sgParent, 0, {
                                x: x,
                                y: y,
                            })
                            this.handlers.push(handler);
                            this.obj = handler;
                        } else {
                            this.obj.setAttribute("cx", x)
                            this.obj.setAttribute("cy", y)
                        }
                        this.updatePolygonByPoints(this.obj.sgParent, this.handlers)
                    }
                }
            });

            // 监听鼠标松开事件
            this.mySvg.addEventListener("mouseup", (e) => {
                const {x, y} = this.svgPositionByViewBox(e.offsetX, e.offsetY);
                if (this.mousePressingMove) {
                    if (this.mode === "select") {
                        if (this.obj.classList.contains("handler")) {
                            this.obj.sgParent.remove();
                            this.clearHandlers();
                        }
                        // const this.obj

                    } else {
                        const captureEnd = this.takeCapture();
                        let sgNode = new SgItemNode(captureEnd);
                        sgNode.mode = this.mode;
                        sgNode.capture = this.capture;
                        this.addNodeToLinkList(sgNode);
                    }

                } else {
                    if (this.type === 'polygon') {
                        if (this.handlers.length === 0) {
                            const option = {
                                type: 'polygon',
                            }
                            const drawObj = createObjectBy(option);
                            this.mySvg.appendChild(drawObj);
                            const handler = this.createHandler(drawObj, 0, {
                                x: x,
                                y: y,
                            })
                            this.handlers.push(handler);
                            this.obj = handler;
                        } else {
                            const prev = this.handlers[this.handlers.length - 2];
                            const curr = this.handlers[this.handlers.length - 1];
                            if (prev.getAttribute("cx") === curr.getAttribute("cx") && prev.getAttribute("cy") === curr.getAttribute("cy")) {
                                // 绘制多边形结束，弹出多余点
                                const endHandler = this.handlers.pop();
                                endHandler.remove();
                                this.updateType("select")
                            } else {
                                const handler = this.createHandler(this.obj.sgParent, 0, {
                                    x: x,
                                    y: y,
                                })
                                this.handlers.push(handler);
                                this.obj = handler;
                            }
                        }
                        this.updatePolygonByPoints(this.obj.sgParent, this.handlers)
                    } else {
                        if (this.obj === this.mySvg) {
                            this.clearHandlers();
                        }
                        // 点击事件
                        if (this.obj !== this.mySvg && !this.obj.classList.contains("handler")) {
                            // 既不是 svg 也不是 handler，只能是图形对象
                            this.clearHandlers();
                            this.addHandlersByObj(this.obj);
                        }
                    }

                }

                // 重置 this.myHand
                this.resetHand();
            });


        } else {
            console.error("svg 元素初始化失败！")
        }

    }
}


/**
 * 矩形点位映射
 *
 * 矩形各个把手示意图
 *   0 1 2
 *   7   3
 *   6 5 4
 */
// 中心对称
const rectCornerMap = {0: "4", 1: "5", 2: "6", 3: "7", 4: "0", 5: "1", 6: "2", 7: "3"};
// 垂直轴对称
const rectVMap = {0: "2", 7: "3", 6: "4", 2: "0", 3: "7", 4: "6"};
// 水平轴对称
const rectHMap = {0: "6", 1: "5", 2: "4", 6: "0", 5: "1", 4: "2"};

/**
 * 矫正矩形
 * @param x 预期原点 X 轴坐标
 * @param y 预期原点 Y 轴坐标
 * @param width 预期宽度（可以为负）
 * @param height 预期高度（可以为负）
 * @returns {{defaultHandler: (number), x: *, width: number, y: *, height: number}}
 */
function correctRect(x, y, width, height) {
    return {
        x: width < 0 ? x + width : x,
        y: height < 0 ? y + height : y,
        width: Math.abs(width),
        height: Math.abs(height),
        defaultHandler: width < 0 && height < 0 ? 0 : width < 0 ? 6 : height < 0 ? 2 : 4
    }
}


/**
 * 判断点位是否在矩形范围内
 *
 * @param x 矩形 x 轴坐标
 * @param y 矩形 y 轴坐标
 * @param width 矩形宽度
 * @param height 矩形高度
 * @param point 点位
 * @returns {boolean} 是否存在于矩形范围内
 */
function isInRect({x, y, width, height}, point) {
    const {x: correctX, y: correctY, width: correctWidth, height: correctHeight} = correctRect(x, y, width, height);
    return point.x >= correctX && point.x <= correctX + correctWidth && point.y >= correctY && point.y <= correctY + correctHeight;
}

/**
 * 判断点位是否在矩形范围（点a、点b确定一个矩形）内
 *
 * @param pointA 点a
 * @param pointB 点b
 * @param point 点位
 * @returns {boolean} 是否存在于矩形范围内
 */
function isInRectByPoints({pointA, pointB}, point) {
    return isInRect({x: pointA.x, y: pointA.y, width: pointB.x - pointA.x, height: pointB.y - pointA.y}, point)
}


/**
 * 根据两点求 “线段” 函数
 *
 * @param pointA 点a
 * @param pointB 点b
 * @returns {(function(*))|(function(*): *)}
 */
function getFuncBy2Points(pointA, pointB) {
    // 如果是垂直的线段
    if (pointA.x === pointB.x) {
        return (x) => x === pointA.x ? x : null;
    } else {
        const ratio = (pointB.y - pointA.y) / (pointB.x - pointA.x);
        const offset = pointB.y - ratio * pointB.x;
        return (x) => x >= Math.min(pointA.x, pointB.x) && x <= Math.max(pointA.x, pointB.x) ? ratio * x + offset : null;
    }
}


/**
 * 动态创建对象，同时使用 option 动态设置属性
 * @param type
 * @param option
 * @returns {*}
 */
function createObjectBy(option) {
    const drawObj = document.createElementNS("http://www.w3.org/2000/svg", option.type);
    for (const [key, value] of Object.entries(option)) {
        drawObj.setAttribute(key, value);
    }
    drawObj.setAttribute("fill", "white");
    drawObj.setAttribute("fill-opacity", 0)
    drawObj.setAttribute("stroke-width", "2");
    drawObj.setAttribute("stroke", "black");
    drawObj.setAttribute("id", getId());

    // 选择模式
    if (option.select) {
        drawObj.setAttribute("stroke-width", "1");
        drawObj.setAttribute("fill", "blue");
        drawObj.setAttribute("fill-opacity", 0.2)
    }
    return drawObj;
}


/**
 * 判断是否是鼠标主键（一般为鼠标左键）
 *
 * @param mouseEvent 鼠标事件
 * @returns {boolean}
 */
function isMouseMain(mouseEvent) {
    return mouseEvent.buttons === 1;
}

/**
 * 获取唯一ID
 * @returns {string}
 */
function getId() {
    return `UID${(new Date()).getTime()}`;
}





