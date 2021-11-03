import {ipcRenderer, remote} from "electron"
import React, {useEffect, useState} from "react"
import closeButtonHover from "../assets/icons/close-hover.png"
import closeButton from "../assets/icons/close.png"
import appIcon from "../assets/icons/icon.png"
import maximizeButtonHover from "../assets/icons/maximize-hover.png"
import maximizeButton from "../assets/icons/maximize.png"
import minimizeButtonHover from "../assets/icons/minimize-hover.png"
import minimizeButton from "../assets/icons/minimize.png"
import starButtonHover from "../assets/icons/star-hover.png"
import starButton from "../assets/icons/star.png"
import updateButtonHover from "../assets/icons/update-hover.png"
import updateButton from "../assets/icons/update.png"
import pack from "../package.json"
import lightButton from "../assets/icons/light.png"
import lightButtonHover from "../assets/icons/light-hover.png"
import darkButton from "../assets/icons/dark.png"
import darkButtonHover from "../assets/icons/dark-hover.png"
import "../styles/titlebar.less"

const TitleBar: React.FunctionComponent = (props) => {
    const [hover, setHover] = useState(false)
    const [hoverClose, setHoverClose] = useState(false)
    const [hoverMin, setHoverMin] = useState(false)
    const [hoverMax, setHoverMax] = useState(false)
    const [hoverReload, setHoverReload] = useState(false)
    const [hoverStar, setHoverStar] = useState(false)
    const [hoverTheme, setHoverTheme] = useState(false)
    const [theme, setTheme] = useState("light")

    useEffect(() => {
        ipcRenderer.invoke("check-for-updates", true)
        const initTheme = async () => {
            const saved = await ipcRenderer.invoke("get-theme")
            changeTheme(saved)
        }
        initTheme()
    }, [])

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
    const star = () => {
        remote.shell.openExternal(pack.repository.url)
    }
    const update = () => {
        ipcRenderer.invoke("check-for-updates", false)
    }

    const changeTheme = (value?: string) => {
        let condition = value !== undefined ? value === "dark" : theme === "light"
        if (condition) {
            document.documentElement.style.setProperty("--bg-color", "#090409")
            document.documentElement.style.setProperty("--title-color", "#090409")
            document.documentElement.style.setProperty("--text-color", "#f33b37")
            document.documentElement.style.setProperty("--version-color", "#090409")
            document.documentElement.style.setProperty("--version-text", "#ff3a5b")
            document.documentElement.style.setProperty("--version-accept", "#090409")
            document.documentElement.style.setProperty("--version-accept-text", "#ff426b")
            document.documentElement.style.setProperty("--version-reject", "#090409")
            document.documentElement.style.setProperty("--version-reject-text", "#be3b57")
            setTheme("dark")
            ipcRenderer.invoke("save-theme", "dark")
            ipcRenderer.invoke("update-color", "dark")
        } else {
            document.documentElement.style.setProperty("--bg-color", "#e14952")
            document.documentElement.style.setProperty("--title-color", "#f33b37")
            document.documentElement.style.setProperty("--text-color", "black")
            document.documentElement.style.setProperty("--version-color", "#ff3a5b")
            document.documentElement.style.setProperty("--version-text", "black")
            document.documentElement.style.setProperty("--version-accept", "#ff426b")
            document.documentElement.style.setProperty("--version-accept-text", "black")
            document.documentElement.style.setProperty("--version-reject", "#be3b57")
            document.documentElement.style.setProperty("--version-reject-text", "black")
            setTheme("light")
            ipcRenderer.invoke("save-theme", "light")
            ipcRenderer.invoke("update-color", "light")
        }
    }

    return (
        <section className="title-bar">
                <div className="title-bar-drag-area">
                    <div className="title-container">
                        <img className="app-icon" height="22" width="22" src={appIcon}/>
                        <p><span className="title">Image Compressor v{pack.version}</span></p>
                    </div>
                    <div className="title-bar-buttons">
                    <img src={hoverTheme ? (theme === "light" ? darkButtonHover : lightButtonHover) : (theme === "light" ? darkButton : lightButton)} height="20" width="20" className="title-bar-button theme-button" onClick={() => changeTheme()} onMouseEnter={() => setHoverTheme(true)} onMouseLeave={() => setHoverTheme(false)}/>
                        <img src={hoverStar ? starButtonHover : starButton} height="20" width="20" className="title-bar-button star-button" onClick={star} onMouseEnter={() => setHoverStar(true)} onMouseLeave={() => setHoverStar(false)}/>
                        <img src={hoverReload ? updateButtonHover : updateButton} height="20" width="20" className="title-bar-button update-button" onClick={update} onMouseEnter={() => setHoverReload(true)} onMouseLeave={() => setHoverReload(false)}/>
                        <img src={hoverMin ? minimizeButtonHover : minimizeButton} height="20" width="20" className="title-bar-button" onClick={minimize} onMouseEnter={() => setHoverMin(true)} onMouseLeave={() => setHoverMin(false)}/>
                        <img src={hoverMax ? maximizeButtonHover : maximizeButton} height="20" width="20" className="title-bar-button" onClick={maximize} onMouseEnter={() => setHoverMax(true)} onMouseLeave={() => setHoverMax(false)}/>
                        <img src={hoverClose ? closeButtonHover : closeButton} height="20" width="20" className="title-bar-button" onClick={close} onMouseEnter={() => setHoverClose(true)} onMouseLeave={() => setHoverClose(false)}/>
                    </div>
                </div>
        </section>
    )
}

export default TitleBar