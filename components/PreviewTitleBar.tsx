import React, {useState, useEffect} from "react"
import {ipcRenderer, remote} from "electron"
import minimizeButton from "../assets/icons/previewMinimize.png"
import maximizeButton from "../assets/icons/previewMaximize.png"
import closeButton from "../assets/icons/previewClose.png"
import minimizeButtonHover from "../assets/icons/previewMinimize-hover.png"
import maximizeButtonHover from "../assets/icons/previewMaximize-hover.png"
import closeButtonHover from "../assets/icons/previewClose-hover.png"
import zoomInButton from "../assets/icons/zoomIn.png"
import zoomInButtonHover from "../assets/icons/zoomIn-hover.png"
import zoomOutButton from "../assets/icons/zoomOut.png"
import zoomOutButtonHover from "../assets/icons/zoomOut-hover.png"
import "../styles/previewtitlebar.less"

interface PreviewTitleBarProps {
    title: string
}

const PreviewTitleBar: React.FunctionComponent<PreviewTitleBarProps> = (props: PreviewTitleBarProps) => {
    let [hoverClose, setHoverClose] = useState(false)
    let [hoverMin, setHoverMin] = useState(false)
    let [hoverMax, setHoverMax] = useState(false)
    let [hoverIn, setHoverIn] = useState(false)
    let [hoverOut, setHoverOut] = useState(false)

    const minimize = () => {
        remote.getCurrentWindow().minimize()
    }

    const maximize = () => {
        const window = remote.getCurrentWindow()
        if (window.isMaximized()) {
            window.unmaximize()
        } else {
            window.maximize()
        }
    }
    
    const close = () => {
        remote.getCurrentWindow().close()
    }

    const zoomOut = () => {
        ipcRenderer.invoke("zoom-out")
    }

    const zoomIn = () => {
        ipcRenderer.invoke("zoom-in")
    }

    return (
        <section className="title-bar">
                <div className="title-bar-drag-area">
                    <div className="title-container">
                        <img height="20" width="20" src={hoverOut ? zoomOutButtonHover : zoomOutButton} className="title-bar-button" onClick={zoomOut} onMouseEnter={() => setHoverOut(true)} onMouseLeave={() => setHoverOut(false)}/>
                        <img height="20" width="20" src={hoverIn ? zoomInButtonHover : zoomInButton} className="title-bar-button" onClick={zoomIn} onMouseEnter={() => setHoverIn(true)} onMouseLeave={() => setHoverIn(false)}/>
                    </div>
                    <div className="title">{props.title}</div>
                    <div className="title-bar-buttons">
                        <img src={hoverMin ? minimizeButtonHover : minimizeButton} height="20" width="20" className="title-bar-button" onClick={minimize} onMouseEnter={() => setHoverMin(true)} onMouseLeave={() => setHoverMin(false)}/>
                        <img src={hoverMax ? maximizeButtonHover : maximizeButton} height="20" width="20" className="title-bar-button" onClick={maximize} onMouseEnter={() => setHoverMax(true)} onMouseLeave={() => setHoverMax(false)}/>
                        <img src={hoverClose ? closeButtonHover : closeButton} height="20" width="20" className="title-bar-button" onClick={close} onMouseEnter={() => setHoverClose(true)} onMouseLeave={() => setHoverClose(false)}/>
                    </div>
                </div>
        </section>
    )
}

export default PreviewTitleBar