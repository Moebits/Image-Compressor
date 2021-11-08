import {ipcRenderer} from "electron"
import {shell} from "@electron/remote"
import React, {useContext, useEffect, useState} from "react"
import {Dropdown, DropdownButton} from "react-bootstrap"
import folderButton from "../assets/icons/folder.png"
import folderButtonHover from "../assets/icons/folder-hover.png"
import {DirectoryContext, QualityContext, OverwriteContext, IgnoreBelowContext, ResizeWidthContext, ResizeHeightContext, PercentageContext, KeepRatioContext, RenameContext, FormatContext} from "../renderer"
import Slider from "rc-slider"
import functions from "../structures/functions"
import "../styles/optionsbar.less"

const OptionsBar: React.FunctionComponent = (props) => {
    const {quality, setQuality} = useContext(QualityContext)
    const {overwrite, setOverwrite} = useContext(OverwriteContext)
    const {ignoreBelow, setIgnoreBelow} = useContext(IgnoreBelowContext)
    const {resizeWidth, setResizeWidth} = useContext(ResizeWidthContext)
    const {resizeHeight, setResizeHeight} = useContext(ResizeHeightContext)
    const {percentage, setPercentage} = useContext(PercentageContext)
    const {keepRatio, setKeepRatio} = useContext(KeepRatioContext)
    const {rename, setRename} = useContext(RenameContext)
    const {format, setFormat} = useContext(FormatContext)
    const {directory, setDirectory} = useContext(DirectoryContext)
    const [folderHover, setFolderHover] = useState(false)
    const [id, setID] = useState(1)

    useEffect(() => {
        ipcRenderer.invoke("get-downloads-folder").then((f) => setDirectory(f))
        initSettings()
        const addFile = (event: any, file: string, pos: number) => {
            setID((prev) => {
                ipcRenderer.invoke("add-file-id", file, pos, prev)
                return prev + 1
            })
        }
        ipcRenderer.on("add-file", addFile)
        ipcRenderer.on("upload", upload)
        return () => {
            ipcRenderer.removeListener("add-file", addFile)
            ipcRenderer.removeListener("upload", upload)
        }
    }, [])

    useEffect(() => {
        ipcRenderer.invoke("store-settings", {quality, directory, overwrite, ignoreBelow, resizeWidth, resizeHeight, percentage, keepRatio, rename, format})
        ipcRenderer.on("on-drop", onDrop)
        return () => {
            ipcRenderer.removeListener("on-drop", onDrop)
        }
    })
    
    const initSettings = async () => {
        const settings = await ipcRenderer.invoke("init-settings")
        if (settings) {
            setQuality(settings.quality)
            setOverwrite(settings.overwrite)
            setIgnoreBelow(settings.ignoreBelow)
            setResizeWidth(settings.resizeWidth)
            setResizeHeight(settings.resizeHeight)
            setPercentage(settings.percentage)
            setKeepRatio(settings.keepRatio)
            setRename(settings.rename)
            setFormat(settings.format)
        }
    }
    
    const changeDirectory = async () => {
        const dir = await ipcRenderer.invoke("select-directory")
        if (dir) setDirectory(dir)
    }

    const handleIgnoreBelow = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value 
        setIgnoreBelow(value)
    }

    const handleResizeWidth = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value 
        setResizeWidth(value)
    }

    const handleResizeHeight = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value 
        setResizeHeight(value)
    }

    const handleRename = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value 
        setRename(value)
    }

    const onDrop = (event: any, files: any) => {
        if (files[0]) {
            const identifers = []
            let counter = id
            for (let i = 0; i < files.length; i++) {
                if (!functions.getType(files[i])) continue
                identifers.push(counter)
                counter += 1
                setID((prev) => prev + 1)
            }
            ipcRenderer.invoke("add-files", files, identifers)
        }
    }

    const upload = async () => {
        const files = await ipcRenderer.invoke("select-files")
        if (files[0]) {
            const identifers = []
            let counter = id
            for (let i = 0; i < files.length; i++) {
                if (!functions.getType(files[i])) continue
                identifers.push(counter)
                counter += 1
                setID((prev) => prev + 1)
            }
            ipcRenderer.invoke("add-files", files, identifers)
        }
    }

    return (
        <section className="options-bar">
            <div className="options-bar-row">
                <button onClick={() => upload()} className="upload-button" ><span>Upload</span></button>
                <p className="options-bar-text">Quality:</p>
                <Slider className="options-slider" onChange={(value) => setQuality(value)} min={1} max={100} step={1} value={quality}/>
                <p className="options-bar-text">{quality}%</p>
            </div>
            <div className="options-bar-row">
                <div className="download-location">
                    <img className="download-location-img" width="25" height="25" src={folderHover ? folderButtonHover : folderButton} onMouseEnter={() => setFolderHover(true)} onMouseLeave={() => setFolderHover(false)} onClick={changeDirectory}/>
                    <p><span className="download-location-text" onDoubleClick={() => shell.openPath(directory)}>{directory}</span></p>
                </div>
                <div className="options-bar-box">
                    <input className="options-bar-checkbox" type="checkbox" checked={overwrite} onChange={() => setOverwrite((prev: boolean) => !prev)}/>
                    <p className="options-bar-text pointer" onClick={() => setOverwrite((prev: boolean) => !prev)}>Overwrite</p>
                </div>
                <div className="options-bar-box">
                    <p className="options-bar-text">Ignore Below:</p>
                    <input className="options-bar-input wide" type="text" value={ignoreBelow} onChange={handleIgnoreBelow}/>
                </div>
            </div>
            <div className="options-bar-row">
                <div className="options-bar-box">
                    <input className="options-bar-checkbox" type="checkbox" checked={percentage} onChange={() => setPercentage((prev: boolean) => !prev)}/>
                    <p className="options-bar-text pointer" onClick={() => setPercentage((prev: boolean) => !prev)}>Percentage</p>
                </div>
                <div className="options-bar-box">
                    <input className="options-bar-checkbox" type="checkbox" checked={keepRatio} onChange={() => setKeepRatio((prev: boolean) => !prev)}/>
                    <p className="options-bar-text pointer" onClick={() => setKeepRatio((prev: boolean) => !prev)}>Keep Ratio</p>
                </div>
                {keepRatio ?
                <div className="options-bar-box">
                    <p className="options-bar-text">Resize:</p>
                    <input className="options-bar-input" type="text" value={resizeWidth} onChange={handleResizeWidth}/>
                    <p className="options-bar-text">{percentage ? "%" : "px"}</p>
                </div>
                :
                <>
                <div className="options-bar-box">
                    <p className="options-bar-text">Width:</p>
                    <input className="options-bar-input" type="text" value={resizeWidth} onChange={handleResizeWidth}/>
                    <p className="options-bar-text">{percentage ? "%" : "px"}</p>
                </div>
                <div className="options-bar-box">
                    <p className="options-bar-text">Height:</p>
                    <input className="options-bar-input" type="text" value={resizeHeight} onChange={handleResizeHeight}/>
                    <p className="options-bar-text">{percentage ? "%" : "px"}</p>
                </div>
                </>
                }
            </div>
            <div className="options-bar-row">
                <div className="options-bar-box">
                    <p className="options-bar-text">Rename:</p>
                    <input className="options-bar-input wide" type="text" value={rename} onChange={handleRename}/>
                </div>
                <div className="options-bar-box">
                    <p className="options-bar-text">Format: </p>
                    <DropdownButton title={format} drop="down">
                        <Dropdown.Item active={format === "original"} onClick={() => setFormat("original")}>original</Dropdown.Item>
                        <Dropdown.Item active={format === "png"} onClick={() => setFormat("png")}>png</Dropdown.Item>
                        <Dropdown.Item active={format === "jpg"} onClick={() => setFormat("jpg")}>jpg</Dropdown.Item>
                        <Dropdown.Item active={format === "gif"} onClick={() => setFormat("gif")}>gif</Dropdown.Item>
                    </DropdownButton>
                </div>
            </div>
        </section>
    )
}

export default OptionsBar