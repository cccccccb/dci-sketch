const IconTypeSize = 256
const TextTypeSize = 16
const ActionTypeSize = 24
const ArtboardPadding = 40
const PreviewArtBoardMargin = 10
const LightBGColor = '#f0f0f0'
const DarkBGColor = '#1f1f1f'
const GenericBGColor = '#e0e0e0'
const NameSeparator = '/'

function checkIconName(name) {
    return name.indexOf(NameSeparator) && name.indexOf(" ") < 0
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

export function OnCreateText() {
    createIconForType("Text")
}
export function OnCreateAction() {
    createIconForType("Action")
}
export function OnCreateIcon() {
    createIconForType("Icon")
}
export function OnCreateBackground() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc)
        UI.alert("No Document", "Please select a document")
    var layers = currentDoc.selectedLayers
    if (!layers || layers.layers.length == 0)
        UI.alert("No artboard", "Please select the artboard")
    layers = layers.layers
    for (const artboard of layers) {
        if (artboard.type != 'Artboard')
            continue
        // check for DCI format
        if (!artboard.name.startsWith("D" + NameSeparator))
            continue
        const artboardName = artboard.name + NameSeparator + "Background"
        var newGeometry = new Document.Rectangle(artboard.frame.x + ArtboardPadding,
            artboard.frame.y + ArtboardPadding, artboard.frame.width, artboard.frame.height)
        // add offset
        createArtboard(artboard.parent, artboardName, newGeometry, artboard.background.color)
    }
}
export function OnRename() {
    var currentDoc = Document.getSelectedDocument()
    if (!currentDoc)
        UI.alert("No Document", "Please select a document")
    var layers = currentDoc.selectedLayers
    if (!layers || layers.layers.length === 0)
        UI.alert("No artboard", "Please select the artboard")
    var newName = UI.getStringFromUser("What's the icon new name?", "")
    if (newName == "") {
        return
    }
    if (!checkIconName(newName)) {
        UI.alert("Invalid Name", "The icon name can't contains the '/ ' characters")
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
    savePanel.title = "Open DCI Files"
    savePanel.prompt = "Open"
    savePanel.message = "Please choose the DCI files"
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

function createIconForType(type) {
    if (!getAndCheckCurrentPage())
        return
    var options = getIconOptionsFromUser()
    if (!options)
        return

    newIconToCurrentPage(options.name, type, options.colorSensitive)
}

function getIconOptionsFromUser() {
    // Get the icon name form user
    var name = UI.getStringFromUser("What's the icon name?", "")
    if (name == "") {
        UI.message("The icon create request is cancelled")
        return
    }
    if (!checkIconName(name)) {
        UI.alert("Invalid Name", "The icon name can't contains the './ ' characters")
        return
    }

    var options = ['Color Sensitive', 'Color Insensitive']
    var selection = UI.getSelectionFromUser("Is a color sensitive icon?", options)
    if (!selection[2])
        return

    return {name: name, colorSensitive: selection[1] === 0}
}

function createArtboardOfIcon(page, name, type, mode, bgColor) {
    const artboardName = 'D' + NameSeparator + name + NameSeparator + type + NameSeparator + mode

    var size = IconTypeSize
    if (type === 'Text')
        size = TextTypeSize
    else if (type === 'Action')
        size = ActionTypeSize

    var artboard = createArtboard(page, artboardName, new Document.Rectangle(0, 0, size, size), bgColor)
    return artboard
}

function createIconGroup(page, iconName, iconType, bgColor, initPos) {
    var normal = createArtboardOfIcon(page, iconName, iconType, "Normal", bgColor)
    normal.frame.x = initPos.x
    normal.frame.y = initPos.y

    var hover = createArtboardOfIcon(page, iconName, iconType, "Hover", bgColor)
    alignAtArtboard(hover, normal, 'right')

    var pressed = createArtboardOfIcon(page, iconName, iconType, "Pressed", bgColor)
    alignAtArtboard(pressed, hover, 'right')

    var disabled = createArtboardOfIcon(page, iconName, iconType, "Disabled", bgColor)
    alignAtArtboard(disabled, pressed, 'right')

    return [normal, hover, pressed, disabled]
}

function newIconToCurrentPage(iconName, iconType, colorSensitive) {
    var currentPage = getAndCheckCurrentPage()
    const rightEdget = getPageRightEdge(currentPage)
    var artboardList

    if (colorSensitive) {
        artboardList = createIconGroup(currentPage, iconName, iconType, LightBGColor, {"x": rightEdget + ArtboardPadding, "y": ArtboardPadding})
        artboardList = createIconGroup(currentPage, iconName, iconType, DarkBGColor, {"x": rightEdget + ArtboardPadding, "y": ArtboardPadding + artboardList[0].frame.height + ArtboardPadding})
    } else {
        artboardList = createIconGroup(currentPage, iconName, iconType, GenericBGColor, {"x": rightEdget + ArtboardPadding, "y": ArtboardPadding})
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
            fileFormat: "webp",
            size: "1x",
            suffix: `@1`
        },
        {
            fileFormat: "webp",
            size: "2x",
            suffix: `@2`
        },
        {
            fileFormat: "webp",
            size: "3x",
            suffix: `@3`
        },
        {
            fileFormat: "webp",
            size: `${rect.width}w`,
            suffix: ""
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

function createDirectory(path, recursive) {
    try {
        FS.mkdirSync(path, {recursive: recursive})
        return true
    } catch {
        return false
    }
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
        UI.alert("No DCI command", "Please install the \"dci\"")
        return
    }

    const tmpPath = FS.mkdtempSync("/tmp/dci-sketch-");
    if (tmpPath === undefined) {
        UI.alert(`Failed on open ${path}`, `Can't create the "${tmpPath}" directory`)
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
    }

     // clean
     FS.rmdirSync(tmpPath, {force: true, recursive: true})
}

function getSizeByName(dciFile) {
    const sections = dciFile.split(PATH.sep)
    const size = Number(sections[1])
    const scale = Number(dciFile.slice(-1))
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
