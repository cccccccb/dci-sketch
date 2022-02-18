const LightBGColor = '#f0f0f0'
const DarkBGColor = '#1f1f1f'
const GenericBGColor = '#e0e0e0'
const NameSeparator = '/'

var Document = require('sketch/dom')
var UI = require('sketch/ui')
const { spawnSync } = require('@skpm/child_process')
var PATH = require('@skpm/path')
var FS = require('@skpm/fs')
var Settings = require('sketch/settings')

export function OnExportIcon() {
    UI.message("导出图标")
    const currentDoc = Document.getSelectedDocument()
    if (!currentDoc) {
        UI.alert("无文档", "请选择一个活动文档！")
        return
    }

    doExportIcon(Document.getSelectedDocument().selectedLayers.layers)
}

export function OnExportPage() {
    UI.message("导出选中页")
    const currentDoc = Document.getSelectedDocument()
    if (!currentDoc) {
        UI.alert("无文档", "请选择一个活动文档！")
        return
    }

    doExportIcon(Document.getSelectedDocument().selectedPage.layers)
}

export function OnExportAll() {
    UI.message("导出全部")
    const currentDoc = Document.getSelectedDocument()
    if (!currentDoc) {
        UI.alert("无文档", "请选择一个活动文档！")
        return
    }

    var layers = []
    for (var page of currentDoc.pages) {
        layers = layers.concat(page.layers)
    }

    doExportIcon(layers)
}

function parseIconName(name) {
    var nameSections = name.split(NameSeparator)
    // invalid name
    if (nameSections.length < 3 || nameSections.length > 4) {
        console.log("Parase Icon Name error: name section is invalid.")
        return
    }

    if (nameSections[0] !== "D")
        return

    return {
        name: nameSections[1],
        mode: nameSections[2],
    }
}

function doArtboardClassifyForIconName(layers) {
    var allIcon = {}

    for (var layer of layers) {
        if (layer.type != "Artboard")
            continue

        var iconProperies = parseIconName(layer.name)
        if (!iconProperies)
            continue
        iconProperies['object'] = layer
        var list = allIcon[iconProperies.name]
        if (!list)
            list = []
        list.push(iconProperies)
        allIcon[iconProperies.name] = list
    }

    return allIcon
}

function doExportIcon(layers) {
    // check dci command
    try {
        FS.accessSync("/usr/local/bin/dci", FS._R_OK)
    } catch {
        UI.alert("未找到 DCI 命令", "请联系管理员安装 \"dci\"")
        return
    }

    const allIcon = doArtboardClassifyForIconName(layers)
    if (!allIcon) {
        return
    }
    var savePanel = NSOpenPanel.openPanel()
    savePanel.title = "导出 DCI"
    savePanel.prompt = "Export"
    savePanel.message = "请选择一个目录！"
    savePanel.canCreateDirectories = true
    savePanel.canChooseFiles = false
    savePanel.canChooseDirectories = true
    savePanel.allowsMultipleSelection = false
    const result = savePanel.runModal()
    if (result !== NSModalResponseOK)
        return
    var saveDir = savePanel.URL().path()
    if (saveDir == "")
        return

    UI.message(`Saveing to ${saveDir}`)
    for (const iconName in allIcon) {
        const iconFileList = allIcon[iconName]
        const iconPath = PATH.join(saveDir, iconName + ".dci")
        // create directory for the icon
        try {
            FS.accessSync(iconPath, FS._R_OK)
            if (!userAccpetOverrideFile(iconPath)) {
                console.log(`Skip ${iconName} on export`)
                continue
            }
            // clean
            spawnSync("rm", [iconPath])
        } catch {
            // continue
        }

        const tmpDir = FS.mkdtempSync("/tmp/dci-sketch-");
        if (tmpDir === undefined) {
            UI.alert(`导出 ${iconName} 失败`, `无法创建 "${tmpDir}" 目录`)
            continue
        }
        const tmpPath = PATH.join(tmpDir, iconName)
        if (!createDirectory(tmpPath, true)) {
            UI.alert(`导出 ${iconName} 失败`, `无法创建 "${tmpDir}" 目录`)
            continue
        }
        for (const file of iconFileList) {
            var subdirNames = generateIconFileNamesByProperies(file)
            if (subdirNames === undefined) {
                UI.alert("警告!", `"${file.object.name}" 是一个无效图标！`);
                continue
            }

            var targetScaleList = []
            // find image pixel ratio list of export
            for (const format of file.object.exportFormats) {
                const size = format.size
                if (size.endsWith("x") && !size.endsWith("px")) {
                    const sizeNumber = Number(size.slice(0, -1))
                    if (Number.isNaN(sizeNumber))
                        continue
                    var suffix = '.' + format.fileFormat.toLowerCase()
                    targetScaleList.push({scale: sizeNumber, format: format.fileFormat, suffix: suffix})
                }
            }
            if (targetScaleList.length === 0)
                continue;

            var padding = Settings.documentSettingForKey(Document.getSelectedDocument(), file.object.id + "Padding")
            var size = Math.max(file.object.frame.width, file.object.frame.height)

            if (padding !== undefined)
                size -= (2 * Number(padding))
            else
                padding = 0
            if (Number.isNaN(size))
                continue

            var linkDir
            var doLink = false
            for (const subdirName of subdirNames) {
                for (const scale of targetScaleList) {
                    const filePath = PATH.join(tmpPath, size.toString(), subdirName, scale.scale.toString())
                    if (!createDirectory(filePath, { recursive: true })) {
                        UI.message(`无法创建 "${filePath}" 目录, 将跳过！`)
                        continue
                    }

                    const data = Document.export(file.object, { formats: scale.format, output: false, scales: String(scale.scale) })
                    // TODO: pare palette data to generate file base name.
                    const fileBaseName = generateFileBaseName(file.object, scale.suffix, filePath, padding)
                    const imageFile = PATH.join(filePath, fileBaseName)
                    if (doLink) {
                        const linkSourcePath = PATH.join(PATH.relative(filePath, linkDir), fileBaseName)
                        console.log("link from:", linkSourcePath, "to:", imageFile)
                        FS.symlinkSync(linkSourcePath, imageFile)
                    } else {
                        linkDir = filePath
                        FS.writeFileSync(imageFile, data)
                        // alpha8 only support for png format.
                        if (scale.suffix.indexOf("png") == -1)
                            continue
                        var paletteSettings = getPaletteSettings(Document.getSelectedDocument(), file.object.id + 'PaletteSettings')
                        if (paletteSettings === undefined)
                            continue
                        if (paletteSettings.paletteRole == -1)
                            continue
                        // Has palette role.
                        var targetPath = PATH.join(filePath, fileBaseName + ".alpha8")
                        const alpha8CommandArgs = ["--toAlpha8", targetPath, imageFile]
                        var alpha8CommandOutput = spawnSync("dci-image-converter", alpha8CommandArgs)
                        if (alpha8CommandOutput && alpha8CommandOutput.status === 0) {
                            FS.unlinkSync(imageFile)
                        }
                    }
                }

                doLink = true
            }
        }
        const args = ["--create", saveDir, tmpPath]
        var output = spawnSync("dci", args)
        console.log("Command: dci, Arguments:", args)
        console.log(output, output.stdout.toString(), output.stderr.toString())
        // clean
        FS.rmdirSync(tmpDir, {force: true, recursive: true})
        if (output && output.status === 0) {
            UI.message(`Sussced`)
        }
    }
    UI.message("Finished")
}

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

function generateFileBaseName(layer, suffix, filePath, padding) {
    var index = 1
    for(var file of FS.readdirSync(filePath).sort()) {
        var existIndex = Number(file.split('.')[0])
        if ((existIndex != undefined) && existIndex >= index)
            index = existIndex + 1
    }

    var name = index.toString() + '.'
    if (padding !== 0)
        name += padding.toString() + "p."

    var paletteSettings = getPaletteSettings(Document.getSelectedDocument(), layer.id + 'PaletteSettings')
    if (paletteSettings != undefined) {
        if (paletteSettings.paletteRole != -1) {
            name += paletteSettings.paletteRole

            if ((paletteSettings.hue != 0) || (paletteSettings.saturation != 0)
            || (paletteSettings.lightness != 0) || (paletteSettings.red != 0)
            || (paletteSettings.green != 0) || (paletteSettings.blue != 0) || (paletteSettings.alpha != 0)) {
                name += ('_' + paletteSettings.hue)
                name += ('_' + paletteSettings.saturation)
                name += ('_' + paletteSettings.lightness)
                name += ('_' + paletteSettings.red)
                name += ('_' + paletteSettings.green)
                name += ('_' + paletteSettings.blue)
                name += ('_' + paletteSettings.alpha)
            }
        }
    }

    if (name.endsWith('.')) {
        name = name.slice(0, -1)
    }
    name += suffix
    return name
}

function userAccpetOverrideFile(filePath) {
    var options = ['覆盖', '跳过']
    var selection = UI.getSelectionFromUser(`"${filePath}" 已存在！`, options)
    if (!selection[2])
        return

    return selection[1] === 0
}

function generateIconFileNamesByProperies(properies) {
    const modeName = properies.mode.toLowerCase()

    if (properies.object.background.color.startsWith(GenericBGColor)) {
        return [`${modeName}.light`, `${modeName}.dark`]
    } else  if (properies.object.background.color.startsWith(LightBGColor)) {
        return [`${modeName}.light`]
    } else if (properies.object.background.color.startsWith(DarkBGColor)) {
        return [`${modeName}.dark`]
    } else {
        console.log(`Invalid background color: ${properies.object.background.color} of ${properies.name}`)
        return
    }
}

function createDirectory(path, recursive) {
    // Call mkdirSync function failed with `recursive` options
    // in some architectures for unknown reason, use the mkdir
    // command instead.

    const args = [path]
    if (recursive)
        args.unshift("-p")

    var copyRet = spawnSync("mkdir", args)
    return copyRet && (copyRet.status === 0)
}
