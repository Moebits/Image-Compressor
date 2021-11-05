import {ipcRenderer, remote, webFrame} from "electron"
import path from "path"
import React, {useContext, useEffect, useRef, useState, useReducer} from "react"
import {ProgressBar} from "react-bootstrap"
import pSBC from "shade-blend-color"
import fs from "fs"
import arrow from "../assets/icons/arrow.png"
import closeContainerHover from "../assets/icons/closeContainer-hover.png"
import closeContainer from "../assets/icons/closeContainer.png"
import locationButtonHover from "../assets/icons/location-hover.png"
import locationButton from "../assets/icons/location.png"
import startButtonHover from "../assets/icons/start-hover.png"
import startButton from "../assets/icons/start.png"
import stopButtonHover from "../assets/icons/stop-hover.png"
import stopButton from "../assets/icons/stop.png"
import trashButtonHover from "../assets/icons/trash-hover.png"
import trashButton from "../assets/icons/trash.png"
import {DirectoryContext, QualityContext, OverwriteContext, IgnoreBelowContext, ResizeWidthContext, ResizeHeightContext, PercentageContext, KeepRatioContext, RenameContext, FormatContext} from "../renderer"
import functions from "../structures/functions"
import "../styles/filecontainer.less"

interface FileContainerProps {
    id: number
    remove: (id: number) => void
    setStart: (id: number) => void
    source: string
    height: number
    width: number
    fileSize: string
}

const FileContainer: React.FunctionComponent<FileContainerProps> = (props: FileContainerProps) => {
    const {quality} = useContext(QualityContext)
    const {overwrite} = useContext(OverwriteContext)
    const {ignoreBelow} = useContext(IgnoreBelowContext)
    const {resizeWidth} = useContext(ResizeWidthContext)
    const {resizeHeight} = useContext(ResizeHeightContext)
    const {percentage} = useContext(PercentageContext)
    const {keepRatio} = useContext(KeepRatioContext)
    const {rename} = useContext(RenameContext)
    const {format} = useContext(FormatContext)
    const {directory, setDirectory} = useContext(DirectoryContext)
    const [hover, setHover] = useState(false)
    const [hoverClose, setHoverClose] = useState(false)
    const [hoverLocation, setHoverLocation] = useState(false)
    const [hoverTrash, setHoverTrash] = useState(false)
    const [hoverStart, setHoverStart] = useState(false)
    const [hoverStop, setHoverStop] = useState(false)
    const [output, setOutput] = useState("")
    const [started, setStarted] = useState(false)
    const [stopped, setStopped] = useState(false)
    const [deleted, setDeleted] = useState(false)
    const [skipped, setSkipped] = useState(false)
    const [progress, setProgress] = useState(null) as any
    const [progressColor, setProgressColor] = useState("")
    const [backgroundColor, setBackgroundColor] = useState("")
    const [progressLock, setProgressLock] = useState(false)
    const [startSignal, setStartSignal] = useState(false)
    const [clearSignal, setClearSignal] = useState(false)
    const [drag, setDrag] = useState(false)
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0)
    const [newBuffer, setNewBuffer] = useState(null as unknown as Buffer)
    const [newFileSize, setNewFileSize] = useState("0KB")
    const [newDimension, setNewDimension] = useState(`${props.width}x${props.height}`)
    const progressBarRef = useRef(null) as React.RefObject<HTMLDivElement>
    const fileContainerRef = useRef(null) as React.RefObject<HTMLElement>

    useEffect(() => {
        const conversionStarted = (event: any, info: {id: number}) => {
            if (info.id === props.id) {
                setStarted(true)
                props.setStart(props.id)
            }
        }
        const conversionFinished = (event: any, info: {id: number, output: string, skipped: boolean, buffer?: Buffer, fileSize?: number}) => {
            if (info.id === props.id) {
                setOutput(info.output)
                if (info.skipped) setSkipped(info.skipped)
                if (info.buffer) setNewBuffer(info.buffer)
                if (info.fileSize) setNewFileSize(functions.readableFileSize(info.fileSize))
            }
        }
        const deletedSource = (event: any, info: {id: number}) => {
            if (info.id === props.id) {
                setStarted(true)
                setOutput(props.source)
                setDeleted(true)
            }
        }
        const startAll = () => {
            setStartSignal(true)
        }
        const clearAll = () => {
            setClearSignal(true)
        }
        ipcRenderer.on("conversion-started", conversionStarted)
        ipcRenderer.on("conversion-finished", conversionFinished)
        ipcRenderer.on("start-all", startAll)
        ipcRenderer.on("clear-all", clearAll)
        ipcRenderer.on("update-color", forceUpdate)
        ipcRenderer.on("deleted-source", deletedSource)
        return () => {
            ipcRenderer.removeListener("conversion-started", conversionStarted)
            ipcRenderer.removeListener("conversion-finished", conversionFinished)
            ipcRenderer.removeListener("start-all", startAll)
            ipcRenderer.removeListener("clear-all", clearAll)
            ipcRenderer.removeListener("update-color", forceUpdate)
            ipcRenderer.removeListener("deleted-source", deletedSource)
        }
    }, [])

    useEffect(() => {
        updateProgressColor()
        updateBackgroundColor()
        if (!started && startSignal) startConversion(true)
        if ((!started || output) && clearSignal) closeConversion()
    })

    useEffect(() => {
        updateRealtime()
        updateDimensions()
    }, [quality, ignoreBelow, resizeWidth, resizeHeight, percentage, keepRatio, format])

    const updateRealtime = async () => {
        if (output) return
        const {buffer, fileSize} = await ipcRenderer.invoke("compress-realtime", {id: props.id, source: props.source, dest: directory, fileSize: props.fileSize, width: props.width, height: props.height, quality, overwrite, ignoreBelow, resizeWidth, resizeHeight, percentage, keepRatio, rename, format})
        setNewBuffer(buffer)
        setNewFileSize(functions.readableFileSize(fileSize))
        const type = format === "original" ? path.extname(props.source).replaceAll(".", "") : format
        ipcRenderer.invoke("preview-realtime", {id: props.id, newSource: functions.bufferToBase64(functions.arrayBufferToBuffer(buffer), type), newFileSize: functions.readableFileSize(fileSize)})
        await functions.timeout(5000)
    }

    const updateDimensions = () => {
        if (output) return
        const {width, height} = functions.parseNewDimensions(props.width, props.height, resizeWidth, resizeHeight, percentage, keepRatio)
        setNewDimension(`${width}x${height}`)
    }

    const startConversion = async (startAll?: boolean) => {
        if (started) return
        setStartSignal(false)
        webFrame.clearCache()
        await functions.timeout(props.id)
        ipcRenderer.invoke("compress", {id: props.id, source: props.source, dest: directory, fileSize: props.fileSize, width: props.width, height: props.height, quality, overwrite, ignoreBelow, resizeWidth, resizeHeight, percentage, keepRatio, rename, format}, startAll)
        if (!startAll) {
            setStarted(true)
            props.setStart(props.id)
        }
    }

    const closeConversion = () => {
        ipcRenderer.invoke("move-queue", props.id)
        if (!output) ipcRenderer.invoke("delete-conversion", props.id)
        ipcRenderer.invoke("close-conversion", props.id)
        props.remove(props.id)
    }

    const deleteConversion = async () => {
        if (deleted) return
        const success = await ipcRenderer.invoke("delete-conversion", props.id, true)
        if (success) {
            ipcRenderer.invoke("move-queue")
            setDeleted(true)
        }
    }

    const stopConversion = async () => {
        if (stopped) return
        if (output) return
        const success = await ipcRenderer.invoke("stop-conversion", props.id)
        if (success) {
            ipcRenderer.invoke("move-queue")
            setStopped(true)
        }
    }

    const updateBackgroundColor = async () => {
        const colors = ["#f63447"]
        const container = fileContainerRef.current?.querySelector(".file-container") as HTMLElement
        if (!container) return
        if (!backgroundColor) {
            const color = colors[Math.floor(Math.random() * colors.length)]
            setBackgroundColor(color)
        }
        const theme = await ipcRenderer.invoke("get-theme")
        if (theme === "light") {
            const text = fileContainerRef.current?.querySelectorAll(".file-text, .file-text-alt") as NodeListOf<HTMLElement>
            text.forEach((t) => {
                t.style.color = "black"
            })
            container.style.backgroundColor = backgroundColor
            container.style.border = `4px solid ${pSBC(0.1, backgroundColor)}`
        } else {
            const text = fileContainerRef.current?.querySelectorAll(".file-text, .file-text-alt") as NodeListOf<HTMLElement>
            text.forEach((t) => {
                t.style.color = backgroundColor
            })
            container.style.backgroundColor = "#090409"
            container.style.border = `4px solid #090409`
        }
    }

    const updateProgressColor = () => {
        const colors = ["#fc0025"]
        const progressBar = progressBarRef.current?.querySelector(".progress-bar") as HTMLElement
        if (started && !progressLock) {
            setProgressColor(colors[Math.floor(Math.random() * colors.length)])
            setProgressLock(true)
        }
        if (output) setProgressColor("#2bffb5")
        if (skipped) setProgressColor("#ff40d9")
        if (stopped) setProgressColor("#ff2495")
        if (deleted) setProgressColor("#5b3bff")
        progressBar.style.backgroundColor = progressColor
    }

    const generateProgressBar = () => {
        let jsx = <p className="file-text-progress black">Waiting...</p>
        let progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        if (started) {
            jsx = <p className="file-text-progress black">Compressing...</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        }
        if (progress !== null) {
            jsx = <p className="file-text-progress">Compressing... {progress.toFixed(2)}%</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={progress}/>
        }
        if (progress === 100) {
            jsx = <p className="file-text-progress black">Finalizing...</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        }
        if (output) {
            jsx = <p className="file-text-progress black">Finished</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        }
        if (skipped) {
            jsx = <p className="file-text-progress black">Skipped</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        }
        if (stopped) {
            jsx = <p className="file-text-progress black">Stopped</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        }
        if (deleted) {
            jsx = <p className="file-text-progress black">Deleted</p>
            progressJSX = <ProgressBar ref={progressBarRef} animated now={100}/>
        }
        return (
            <>
            <div className="file-text-progress-container">{jsx}</div>
            {progressJSX}
            </>
        )
    }

    const mouseEnter = () => {
        document.documentElement.style.setProperty("--selection-color", pSBC(0.5, backgroundColor))
    }

    const mouseLeave = () => {
        setHover(false)
        document.documentElement.style.setProperty("--selection-color", "#ffb5cb")
    }

    const openLocation = (direct?: boolean) => {
        const location = output ? output : props.source
        if (!fs.existsSync(location)) return
        if (direct) {
            remote.shell.openPath(path.normalize(location))
        } else {
            remote.shell.showItemInFolder(path.normalize(location))
        }
    }

    const diffPercentage = () => {
        const oldSize = functions.parseFileSize(props.fileSize)
        const newSize = functions.parseFileSize(newFileSize)
        if (oldSize > newSize) {
            const percent = (1 - (newSize / oldSize)) * 100
            return ` -${parseInt(String(percent))}%`
        } else {
            const percent = ((newSize / oldSize) - 1) * 100
            return ` +${parseInt(String(percent))}%`
        }
    }

    const preview = (event: React.MouseEvent<HTMLElement>) => {
        const title = output ? functions.cleanTitle(path.basename(output)) : functions.cleanTitle(path.basename(props.source))
        const type = format === "original" ? path.extname(props.source).replaceAll(".", "") : format
        if (event.button === 2) ipcRenderer.invoke("preview", {id: props.id, title, source: props.source, fileSize: props.fileSize, newSource: functions.bufferToBase64(functions.arrayBufferToBuffer(newBuffer), type), newFileSize})
    }

    const delayPress = (event: React.MouseEvent<HTMLElement>) => {
        if (event.button === 2) return event.stopPropagation()
    }

    return (
        <section ref={fileContainerRef} className="file-wrap-container" onMouseOver={() => setHover(true)} onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
            <div className="file-container" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onMouseDown={() => setDrag(false)} onMouseMove={() => setDrag(true)}>
            <div className="file-img-container">
                <img className="file-img" onMouseDown={delayPress} onMouseUp={preview} src={output ? output : props.source}/>
            </div>
            <div className="file-middle">
                <div className="file-group-top">
                    <div className="file-name">
                        <p className="file-text bigger"><span className="hover" onClick={() => openLocation(true)}>{output ? functions.cleanTitle(path.basename(output)) : functions.cleanTitle(path.basename(props.source))}</span></p>
                        <p className="file-text bigger pink">{diffPercentage()}</p>
                    </div>
                    <div className="file-info">
                            <p className="file-text" onMouseDown={(event) => event.stopPropagation()}>{props.fileSize}</p>
                            <img className="file-arrow" width="25" height="25" src={arrow} onMouseDown={(event) => event.stopPropagation()}/>
                            <p className="file-text" onMouseDown={(event) => event.stopPropagation()}>{newFileSize}</p>
                    </div>
                    <div className="file-info">
                            <p className="file-text" onMouseDown={(event) => event.stopPropagation()}>{props.width}x{props.height}</p>
                            <img className="file-arrow" width="25" height="25" src={arrow} onMouseDown={(event) => event.stopPropagation()}/>
                            <p className="file-text" onMouseDown={(event) => event.stopPropagation()}>{newDimension}</p>
                    </div>
                </div>
                <div className="file-progress">
                    {generateProgressBar()}
                </div>
            </div>
            <div className="file-buttons">
                {hover ? <img className="file-button close-container" width="28" height="28" onMouseDown={(event) => event.stopPropagation()} src={hoverClose ? closeContainerHover : closeContainer} onClick={closeConversion} onMouseEnter={() => setHoverClose(true)} onMouseLeave={() => setHoverClose(false)}/> : null}
                <div className="file-button-row">
                    <img className="file-button start-button" width="129" height="36" onMouseDown={(event) => event.stopPropagation()} onClick={() => {started ? stopConversion() : startConversion()}} src={started ? (hoverStop ? stopButtonHover : stopButton) : (hoverStart ? startButtonHover : startButton)} onMouseEnter={() => {setHoverStart(true); setHoverStop(true)}} onMouseLeave={() => {setHoverStart(false); setHoverStop(false)}}/>
                </div>
                <div className="file-button-row">
                    {output ? <img className="file-button" width="50" height="50" onMouseDown={(event) => event.stopPropagation()} src={hoverLocation ? locationButtonHover : locationButton} onClick={() => openLocation()} onMouseEnter={() => setHoverLocation(true)} onMouseLeave={() => setHoverLocation(false)}/> : null}
                    {output ? <img className="file-button" width="50" height="50" onMouseDown={(event) => event.stopPropagation()} src={hoverTrash ? trashButtonHover : trashButton} onClick={deleteConversion} onMouseEnter={() => setHoverTrash(true)} onMouseLeave={() => setHoverTrash(false)}/> : null}
                </div>
            </div>
            </div>
        </section>
    )
}

export default FileContainer