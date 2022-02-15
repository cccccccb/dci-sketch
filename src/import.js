const ArtboardPadding = 40
const PreviewArtBoardMargin = 10
const LightBGColor = '#f0f0f0'
const DarkBGColor = '#1f1f1f'
const GenericBGColor = '#e0e0e0'
const NameSeparator = '/'

function checkIconName(name) {
    return (
        name.indexOf(NameSeparator) < 0)
        && (name.indexOf(" ") < 0
        && (name.indexOf(".") < 0)
    )
}

function getAndCheckCurrentPage() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc)
        UI.alert("No Document", "Please select a document")

    var currentPage = currentDoc.selectedPage

    if (!currentPage)
        UI.alert("No Page", "Please select a page")
    return currentPage
}

var Document = require('sketch/dom')
var UI = require('sketch/ui')
const { spawnSync } = require('@skpm/child_process')
var PATH = require('@skpm/path')
var FS = require('@skpm/fs')
var Settings = require('sketch/settings')

function getPaletteSettings(document, key) {
    var paletteSetting = Settings.documentSettingForKey(document, key)

    if (paletteSetting === undefined) {
        paletteSetting = {
            paletteRole: -1,
            hue: 0,
            saturation: 0,
            lightness: 0,
            red: 0,
            green: 0,
            blue: 0,
            alpha: 0
        }
    }

    return paletteSetting
}

function setPaletteSetting(document, key, settings) {
    Settings.setDocumentSettingForKey(document, key, settings)
}

function addLabelField(x, y, title, value, view) {
    var label = NSTextField.alloc().initWithFrame(NSMakeRect(x, y - 5, 80, 25))
    label.setBezeled(false)
    label.setDrawsBackground(false)
    label.setEditable(false)
    label.setSelectable(false)
    label.setStringValue(title)
    label.setFont(NSFont.paletteFontOfSize(NSFont.systemFontOfSize(8)))
    view.addSubview(label)

    var field = NSTextField.alloc().initWithFrame(NSMakeRect(x + 80, y, 150, 23))
    field.setPlaceholderString("-100 - +100 (例如： -25, +40)")
    field.setIntValue(value)
    view.addSubview(field)
    return field
}

export function ShowLayerPalette() {
    var doc = Document.getSelectedDocument()
    if (!doc) {
        UI.alert("无文档", "请先选择一个文档！")
        return
    }

    var layers = doc.selectedLayers
    if (!layers) {
        UI.alert("请选择画板", "仅支持选中画板！")
        return
    }

    for (var i = 0; i < layers.length; ++i) {
        if (layers.layers[i].type != 'Artboard') {
            UI.alert("请选择画板", "仅支持选中画板！")
            return
        }
    }

    var selectedLayers = layers.layers
    var paletteSetting
    for (var layer of selectedLayers) {
        const key = layer.id + "PaletteSettings"
        var paletteSettingOfLayer = getPaletteSettings(doc, key)
        if (paletteSetting === undefined)
            paletteSetting = paletteSettingOfLayer

        if (paletteSetting.paletteRole != paletteSettingOfLayer.paletteRole
            || paletteSetting.hue != paletteSettingOfLayer.hue
            || paletteSetting.saturation != paletteSettingOfLayer.saturation
            || paletteSetting.lightness != paletteSettingOfLayer.lightness
            || paletteSetting.red != paletteSettingOfLayer.red
            || paletteSetting.green != paletteSettingOfLayer.green
            || paletteSetting.blue != paletteSettingOfLayer.blue
            || paletteSetting.alpha != paletteSettingOfLayer.alpha) {
                var alertDataDiff = NSAlert.alloc().init()
                alertDataDiff.setMessageText("选中画板数据不一致")
                alertDataDiff.setInformativeText("已选中多个不同画板，设置参数后将应用于所有画板！")
                alertDataDiff.addButtonWithTitle("确定")
                alertDataDiff.addButtonWithTitle("取消")

                var ret = alertDataDiff.runModal()
                if (ret !== 1000)
                    return

                paletteSetting.paletteRole = -1
                paletteSetting.hue = 0
                paletteSetting.saturation = 0
                paletteSetting.lightness = 0
                paletteSetting.red = 0
                paletteSetting.green = 0
                paletteSetting.blue = 0
                paletteSetting.alpha = 0
                break
            }
    }

    var paletteRole = paletteSetting.paletteRole
    var hue = paletteSetting.hue
    var saturation =  paletteSetting.saturation
    var lightness = paletteSetting.lightness
    var red = paletteSetting.red
    var green = paletteSetting.green
    var blue = paletteSetting.blue
    var alpha = paletteSetting.alpha

    var alert = NSAlert.alloc().init()
    alert.setMessageText("画板调色板")
    alert.addButtonWithTitle("确定")
    alert.addButtonWithTitle("取消")

    var view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 285, 330))
    alert.setAccessoryView(view)
    COScript.currentCOScript().setShouldKeepAround(true)

    var paletteList = [
        {
            title: "无",
            value: -1
        },
        {
            title: "前景色",
            value: 0
        },
        {
            title: "背景色",
            value: 1
        },
        {
            title: "活动色的前景色",
            value: 2
        },
        {
            title: "活动色",
            value: 3
        },
    ]

    var paletteRoleLabel = NSTextField.alloc().initWithFrame(NSMakeRect(10, 295, 80, 25))
    paletteRoleLabel.setBezeled(false)
    paletteRoleLabel.setDrawsBackground(false)
    paletteRoleLabel.setEditable(false)
    paletteRoleLabel.setSelectable(false)
    paletteRoleLabel.setStringValue("画板颜色")
    paletteRoleLabel.setFont(NSFont.paletteFontOfSize(NSFont.systemFontSize()))
    view.addSubview(paletteRoleLabel)

    var selectMenuIndex = 0
    var menu = NSMenu.alloc().init()
    var menuItemCallBack = function(menuItem) {
        paletteSetting.paletteRole = menuItem.representedObject()
    }

    paletteList.forEach(function(palette, index) {
        var item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent(palette.title, nil, "")
        item.setEnabled(true)
        item.setRepresentedObject(palette.value)
        item.setCOSJSTargetFunction(menuItemCallBack)
        menu.addItem(item)
        if (palette.value == paletteRole) {
            selectMenuIndex = index
        }
    })
    var order = NSPopUpButton.alloc().initWithFrame(NSMakeRect(100, 300, 150, 23))
    order.setNeedsDisplay()
    order.setMenu(menu)
    order.selectItemAtIndex(selectMenuIndex)
    view.addSubview(order)

    var adjustLabel = NSTextField.alloc().initWithFrame(NSMakeRect(10, 250, 80, 25))
    adjustLabel.setBezeled(false)
    adjustLabel.setDrawsBackground(false)
    adjustLabel.setEditable(false)
    adjustLabel.setSelectable(false)
    adjustLabel.setStringValue("色彩微调")
    adjustLabel.setFont(NSFont.paletteFontOfSize(NSFont.systemFontSize()))
    view.addSubview(adjustLabel)

    var hueField = addLabelField(20, 220, "色调", hue, view)
    var saturationField =addLabelField(20, 185, "饱和度", saturation, view)
    var lightnessField = addLabelField(20, 150, "亮度", lightness, view)
    var redField = addLabelField(20, 115, "红色", red, view)
    var greenField = addLabelField(20, 80, "绿色", green, view)
    var blueField = addLabelField(20, 45, "蓝色", blue, view)
    var alphaField = addLabelField(20, 10, "不透明度", alpha, view)

    var ret = alert.runModal()
    if (ret !== 1000)
        return

    paletteSetting.hue = hueField.intValue()
    paletteSetting.saturation = saturationField.intValue()
    paletteSetting.lightness = lightnessField.intValue()
    paletteSetting.red = redField.intValue()
    paletteSetting.green = greenField.intValue()
    paletteSetting.blue = blueField.intValue()
    paletteSetting.alpha = alphaField.intValue()

    for (var layer of selectedLayers) {
        const key = layer.id + "PaletteSettings"
        setPaletteSetting(doc, key, paletteSetting)
    }
}

export function OnCreate() {
    if (!getAndCheckCurrentPage())
        return
    var options = getIconOptionsFromUser()
    if (!options)
        return
    newIconToCurrentPage(options.name, options.colorSensitive)
}

export function AddArtboardPadding() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc) {
        UI.alert("无文档", "请选择一个文档！")
        return
    }

    var layers = currentDoc.selectedLayers
    if (!layers || layers.layers.length === 0) {
        UI.alert("无画板", "请选择一个画板")
        return
    }

    var alert = NSAlert.alloc().init()
    alert.setMessageText("添加画板外间距")
    alert.addButtonWithTitle("确定")
    alert.addButtonWithTitle("取消")

    var view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 250, 100))
    alert.setAccessoryView(view)

    var key = layers.layers[0].id + "Padding"
    var padding = Settings.documentSettingForKey(currentDoc, key)
    if (padding === undefined)
        padding = 0
    else
        padding = Number(padding)

    var field = addLabelField(0, 50, "外间距", padding, view)
    var ret = alert.runModal()
    if (ret !== 1000)
        return

    setPaletteSetting(currentDoc, key, field.intValue())
}

export function OnRename() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc) {
        UI.alert("无文档", "请选择一个文档！")
        return
    }

    var layers = currentDoc.selectedLayers
    if (!layers || layers.layers.length === 0) {
        UI.alert("无画板", "请选择一个画板")
        return
    }

    var newName = UI.getStringFromUser("请输入图标的新名称", "")
    if (newName == "") {
        return
    }
    if (!checkIconName(newName)) {
        UI.alert("无效名称", "图标名称中包含 './ ' 等无效字符！")
        return
    }
    layers = layers.layers
    for (var artboard of layers) {
        if (artboard.type != 'Artboard')
            continue
        // check for DCI format
        if (!artboard.name.startsWith("D" + NameSeparator))
            continue
        // rename
        var name_sections = artboard.name.split(NameSeparator)
        name_sections[1] = newName
        artboard.name = name_sections.join(NameSeparator)
    }
}
// unpack the dci file
export function OnOpen() {
    var savePanel = NSOpenPanel.openPanel()
    savePanel.title = "打开 DCI 文件"
    savePanel.prompt = "打开"
    savePanel.message = "请选择一个 DCI 文件"
    savePanel.canCreateDirectories = false
    savePanel.canChooseFiles = true
    savePanel.canChooseDirectories = false
    savePanel.allowsMultipleSelection = true
    const result = savePanel.runModal()
    if (result !== NSModalResponseOK)
        return
    var openFiles = savePanel.URLs()
    if (openFiles.length === 0)
        return
    for (var i = 0; i < openFiles.length; ++i)
        showDciFileContents(openFiles[i])
}

function getIconOptionsFromUser() {
    var alert = NSAlert.alloc().init()
    alert.setMessageText("图标基本信息")
    alert.addButtonWithTitle("确定")
    alert.addButtonWithTitle("取消")

    var view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 180, 150))
    alert.setAccessoryView(view)
    COScript.currentCOScript().setShouldKeepAround(true)

    var iconNameLabel = NSTextField.alloc().initWithFrame(NSMakeRect(45, 120, 90, 25))
    iconNameLabel.setBezeled(false)
    iconNameLabel.setDrawsBackground(false)
    iconNameLabel.setEditable(false)
    iconNameLabel.setSelectable(false)
    iconNameLabel.setStringValue("请输入图标名")
    iconNameLabel.setFont(NSFont.paletteFontOfSize(NSFont.systemFontSize()))
    view.addSubview(iconNameLabel)

    var nameField = NSTextField.alloc().initWithFrame(NSMakeRect(0, 95, 180, 23))
    nameField.setPlaceholderString("请勿包含'./'或空格等特殊符号！")
    view.addSubview(nameField)

    var colorSensitiveLabel = NSTextField.alloc().initWithFrame(NSMakeRect(13, 45, 160, 25))
    colorSensitiveLabel.setBezeled(false)
    colorSensitiveLabel.setDrawsBackground(false)
    colorSensitiveLabel.setEditable(false)
    colorSensitiveLabel.setSelectable(false)
    colorSensitiveLabel.setStringValue("请选择所绘制图标的类型？")
    colorSensitiveLabel.setFont(NSFont.paletteFontOfSize(NSFont.systemFontSize()))
    view.addSubview(colorSensitiveLabel)

    var colorSensitives = [
        {
            title: "深浅主题通用",
            value: false
        },
        {
            title: "区分深浅主题",
            value: true
        }
    ]

    var currentMenuVar = false
    var menu = NSMenu.alloc().init()
    var menuItemCallBack = function(menuItem) {
        currentMenuVar = menuItem.representedObject()
    }

    colorSensitives.forEach(function(color, _) {
        var item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent(color.title, nil, "")
        item.setEnabled(true)
        item.setRepresentedObject(color.value)
        item.setCOSJSTargetFunction(menuItemCallBack)
        menu.addItem(item)
    })
    var order = NSPopUpButton.alloc().initWithFrame(NSMakeRect(0, 20, 180, 23))
    order.setNeedsDisplay()
    order.setMenu(menu)
    order.selectItemAtIndex(0)
    view.addSubview(order)

    var ret = alert.runModal()
    if (ret !== 1000)
        return

    var name = nameField.stringValue()
    if (name == "") {
        UI.alert("名称为空", "请输入图标名称！")
        return
    }

    if (!checkIconName(name)) {
        UI.alert("无效名称", "图标名称中包含 './ ' 等无效字符！")
        return
    }

    return {name: name, colorSensitive: Number(currentMenuVar)}
}

function createArtboardOfIcon(page, name, mode, bgColor) {
    var artboardName = 'D' + NameSeparator + name + NameSeparator + mode
    if (bgColor === LightBGColor) {
        artboardName += (NameSeparator + "Light")
    } else if (bgColor === DarkBGColor) {
        artboardName += (NameSeparator + "Dark")
    }

    var size = 36  // TODO
    var artboard = createArtboard(page, artboardName, new Document.Rectangle(0, 0, size, size), bgColor)

    return artboard
}

function createIconGroup(page, iconName, bgColor, initPos) {
    var normal = createArtboardOfIcon(page, iconName, "Normal", bgColor)
    normal.frame.x = initPos.x
    normal.frame.y = initPos.y

    var hover = createArtboardOfIcon(page, iconName, "Hover", bgColor)
    alignAtArtboard(hover, normal, 'right')

    var pressed = createArtboardOfIcon(page, iconName, "Pressed", bgColor)
    alignAtArtboard(pressed, hover, 'right')

    var disabled = createArtboardOfIcon(page, iconName, "Disabled", bgColor)
    alignAtArtboard(disabled, pressed, 'right')

    return [normal, hover, pressed, disabled]
}

function newIconToCurrentPage(iconName, colorSensitive) {
    var currentPage = getAndCheckCurrentPage()
    const rightEdget = getPageRightEdge(currentPage)
    var artboardList

    if (colorSensitive) {
        artboardList = createIconGroup(currentPage, iconName, LightBGColor, {"x": rightEdget + ArtboardPadding, "y": ArtboardPadding})
        artboardList = createIconGroup(currentPage, iconName, DarkBGColor, {"x": rightEdget + ArtboardPadding, "y": ArtboardPadding + artboardList[0].frame.height + ArtboardPadding})
    } else {
        artboardList = createIconGroup(currentPage, iconName, GenericBGColor, {"x": rightEdget + ArtboardPadding, "y": ArtboardPadding})
    }

    // view to center for artboard list of icon
    Document.getSelectedDocument().centerOnLayer(artboardList[1])
}

function alignAtArtboard(source, target, position) {
    if (position === 'right') {
        source.frame.x = target.frame.x + target.frame.width + ArtboardPadding
        source.frame.y = target.frame.y
    } else if (position === 'bottom') {
        source.frame.y = target.frame.y + target.frame.height + ArtboardPadding
        source.frame.x = target.frame.x
    }
}

function createArtboard(parent, name, rect, color) {
    var artboard = new Document.Artboard({
        name: name,
        parent: parent,
        frame: rect,
        flowStartPoint: false
    })

    artboard.background.enabled = true
    artboard.background.includedInExport = false
    artboard.background.color = color

    artboard.exportFormats = [
        {
            fileFormat: "png",
            size: "1x"
        },
        {
            fileFormat: "png",
            size: "2x"
        },
        {
            fileFormat: "png",
            size: "3x"
        }
    ]

    return artboard
}

function getPageRightEdge(page) {
    var right = 0
    for (const layer of page.layers) {
        if (layer.frame.x + layer.frame.width > right)
            right = layer.frame.x + layer.frame.width
    }
    return right
}

function createDciPreviewArtboard(page, iconName, width, height) {
    const name = "D/P/" + iconName
    var currentDoc = Document.getSelectedDocument()
    const layers = currentDoc.getLayersNamed(name)
    // clean old
    for (const l of layers) {
        if (l.type === "Artboard" && l.parent.id == page.id)
            l.remove()
    }

    const rightEdge = getPageRightEdge(page) + ArtboardPadding
    var artboard = new Document.Artboard({
        name: name,
        parent: page,
        frame: {x: rightEdge, y: ArtboardPadding, width: width, height: height},
        flowStartPoint: false
    })

    return artboard
}

function findChildByName(parent, name) {
    for (const l of parent.layers) {
        if (l.name == name)
            return l
    }
}

function createGroups(parent, path, size) {
    const list = path.split(PATH.sep)

    for (const group of list) {
        const child = findChildByName(parent, group)
        if (child === undefined) {
            parent = new Document.Group({
                name: group,
                parent: parent
            })
            parent.frame.width = size.width
            parent.frame.height = size.height
        } else {
            parent = child
        }
    }

    return parent
}

function showDciFileContents(url) {
    const page = getAndCheckCurrentPage()
    const path = url.path()
    if (!path.endsWith(".dci"))
        return
    // check dci command
    try {
        FS.accessSync("/usr/local/bin/dci", FS._R_OK)
    } catch {
        UI.alert("未找到 DCI 命令", "请联系管理员安装 \"dci\"")
        return
    }

    const tmpPath = FS.mkdtempSync("/tmp/dci-sketch-");
    if (tmpPath === undefined) {
        UI.alert(`打开路径 ${path} 失败`, `无法创建 "${tmpPath}" 目录！`)
        return
    }
    const output = spawnSync("dci", ['--export', tmpPath, path])
    if (output && output.status === 0) {
        const iconName = PATH.basename(path, PATH.extname(path))
        var maxWidth = 0, maxHeight = 0
        /*
        {
            width: Number,
            height: Number
            isDark: Boolean,
            children: []
        }
        */
        var groupInfo = new Map()

        for (var file of FS.readdirSync(tmpPath).sort()) {
            if (!file.startsWith(PATH.join(iconName, "")))
                continue
            const filePath = PATH.join(tmpPath, file)
            var buffer
            try {
                buffer = FS.readFileSync(filePath)
            } catch {
                continue
            }

            if (buffer === undefined)
                continue
            var layer = new Document.Image({
                image: buffer,
                name: PATH.basename(file),
                locked: true
            })
            if (!layer)
                continue
            const dir = PATH.dirname(file).slice(iconName.length + 1)
            // don't use resizeToOriginalSize
            const imageSize = getSizeByName(PATH.join(dir, layer.name))
            if (imageSize === undefined)
                continue
            layer.frame.width = imageSize
            layer.frame.height = imageSize

            if (!groupInfo.has(dir)) {
                groupInfo.set(dir, {width: PreviewArtBoardMargin, height: PreviewArtBoardMargin, y: maxHeight + PreviewArtBoardMargin,
                    isDark: dir.lastIndexOf(".dark") > 0, children: []})
            }
            var group = groupInfo.get(dir)
            group.width += layer.frame.width + PreviewArtBoardMargin
            group.height = Math.max(group.height, layer.frame.height + PreviewArtBoardMargin)
            group.children.push(layer)

            maxWidth = Math.max(maxWidth, group.width)
            maxHeight = Math.max(maxHeight, group.y + group.height - 1)
        }

        var artboard = createDciPreviewArtboard(page, iconName, maxWidth, maxHeight)
        var finalGroupList = []
        for (const i of groupInfo) {
            const path = i[0]
            const group = i[1]
            var groupObj = createGroups(artboard, path, {width: maxWidth, height: maxHeight})
            groupObj.frame.y = group.y
            groupObj.frame.width = group.width
            groupObj.frame.height = group.height

            finalGroupList.push(groupObj)

            var right = PreviewArtBoardMargin
            for (var c of group.children) {
                c.parent = groupObj
                c.frame.x = right
                c.frame.y = 0
                right += c.frame.width + PreviewArtBoardMargin

                createBackgroundFor(c, group.isDark ? DarkBGColor : LightBGColor).moveToBack()
            }
        }

        // view to center for artboard list of icon
        Document.getSelectedDocument().centerOnLayer(artboard)
    }

     // clean
     FS.rmdirSync(tmpPath, {force: true, recursive: true})
}

function getSizeByName(dciFile) {
    const sections = dciFile.split(PATH.sep)
    const size = Number(sections[0])
    const scale = Number(sections[2])
    if (Number.isNaN(size) || Number.isNaN(scale))
        return
    return size * scale
}

function createBackgroundFor(layer, color) {
    // init background
    var fill = new Document.ShapePath({
        name: "__fill__",
        parent: layer.parent,
        frame: layer.frame
    })
    fill.style.fills = [{
        fillType: Document.Style.FillType.Color,
        color: color
    }]

    return fill
}
