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
     * 现有把手，用于维护编辑状态的所有对象
     */
    handlers = [];
    /**
     * 用于记录 x 轴坐标
     * 绘图时：用作记录原点
     * 拖动时：可以复用为上一次移动的点
     */
    startX = 0;
    /**
     * 用于记录 y 轴坐标
     * 绘图时：用作记录原点
     * 拖动时：可以复用为上一次移动的点
     */
    startY = 0;

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
                handlers = createHandlers(this.mySvg, obj, 2);
                defaultHandler = handlers[obj.defaultHandler ?? 1];
                break;
            case "rect":
                if (obj.getAttribute("select")) {
                    handlers = createHandlers(this.mySvg, obj, 8, {hidden: true});
                } else {
                    handlers = createHandlers(this.mySvg, obj, 8);
                }
                defaultHandler = handlers[obj.defaultHandler ?? 4];
                break;
        }
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
        this.obj = null;
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

    moveObjTo(handler, x, y) {
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
        }
        this.updateHandlersByObj(obj);
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
            this.mySvg.addEventListener("mousedown", (e) => {
                // 监听鼠标按下事件，设置 this.myHand
                this.mousePressed = true;
                // this.mousePressingMove = false;
                this.startX = e.offsetX;
                this.startY = e.offsetY;

                this.obj = e.target;
            });
            this.mySvg.addEventListener("mousemove", (e) => {
                if (this.mousePressed) {
                    // 只处理按下移动事件
                    this.mousePressingMove = true;

                    if (this.obj?.classList.contains("handler")) {
                        if (!this.mode) {
                            // 把当前选中的对象，创建快照
                            this.capture = this.takeCapture();
                            this.mode = "modify";
                        }
                        this.moveObjTo(this.obj, e.offsetX, e.offsetY)
                    } else {
                        if (this.type) {
                            this.clearHandlers();
                            let option = null;
                            switch (this.type) {
                                case "line":
                                    option = {
                                        x1: this.startX,
                                        y1: this.startY,
                                        x2: e.offsetX,
                                        y2: e.offsetY,
                                    }
                                    option.type = 'line';
                                    break;
                                case "rect":
                                    option = correctRect(this.startX, this.startY, e.offsetX - parseFloat(this.startX), e.offsetY - parseFloat(this.startY))
                                    option.type = 'rect';
                                    break;
                                case "select":
                                    if (this.obj === this.mySvg) {
                                        option = correctRect(this.startX, this.startY, e.offsetX - parseFloat(this.startX), e.offsetY - parseFloat(this.startY));
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
                                this.offsetObjTo(this.obj, e.offsetX - this.startX, e.offsetY - this.startY)
                                this.startX = e.offsetX;
                                this.startY = e.offsetY;
                            }
                        }

                    }
                }
            });
            this.mySvg.addEventListener("mouseup", (e) => {
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

                // 重置 this.myHand
                this.resetHand();
            });


        } else {
            console.error("svg 元素初始化失败！")
        }

    }
}


/**
 * 创建多个 handler
 */
function createHandlers(mySvg, sgParent, number, option) {
    const handlers = []
    for (let i = 0; i < number; i++) {
        handlers.push(createHandler(mySvg, sgParent, i, option));
    }
    return handlers;
}

/**
 * 创建“把手”
 */
function createHandler(mySvg, sgParent, position, option) {
    const handler = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handler.setAttribute("cx", 0);
    handler.setAttribute("cy", 0);
    handler.setAttribute("r", "3");
    handler.setAttribute("fill", "white");
    handler.setAttribute("stroke", "black");

    // 如果是隐形 handler
    if (option?.hidden) {
        handler.setAttribute("opacity", 0);
        handler.setAttribute("stroke-opacity", 0);
    }
    handler.setAttribute("handlerPosition", position);

    handler.classList.add("handler");
    handler.sgParent = sgParent;
    mySvg.appendChild(handler);
    return handler;
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
 * 获取唯一ID
 * @returns {string}
 */
function getId() {
    return `UID${(new Date()).getTime()}`;
}

/**
 * 矩形点位映射
 * @type {{"0": string, "1": string, "2": string, "3": string, "4": string, "5": string, "6": string, "7": string}}
 */
const rectCornerMap = {0: "4", 1: "5", 2: "6", 3: "7", 4: "0", 5: "1", 6: "2", 7: "3"};
const rectVMap = {0: "2", 7: "3", 6: "4", 2: "0", 3: "7", 4: "6"};
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


