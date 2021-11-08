import {ipcRenderer} from "electron"
import React, {useContext, useState, useEffect} from "react"
import clearAllButtonHover from "../assets/icons/clearAll-hover.png"
import clearAllButton from "../assets/icons/clearAll.png"
import clearAllButtonDarkHover from "../assets/icons/clearAll-hover-dark.png"
import clearAllButtonDark from "../assets/icons/clearAll-dark.png"
import startAllButtonHover from "../assets/icons/startAll-hover.png"
import startAllButton from "../assets/icons/startAll.png"
import startAllButtonDarkHover from "../assets/icons/startAll-hover-dark.png"
import startAllButtonDark from "../assets/icons/startAll-dark.png"
import deleteDuplicatesButtonHover from "../assets/icons/deleteDuplicates-hover.png"
import deleteDuplicatesButton from "../assets/icons/deleteDuplicates.png"
import deleteDuplicatesButtonDarkHover from "../assets/icons/deleteDuplicates-hover-dark.png"
import deleteDuplicatesButtonDark from "../assets/icons/deleteDuplicates-dark.png"
import {ClearAllContext} from "../renderer"
import "../styles/groupaction.less"

const GroupAction: React.FunctionComponent = (props) => {
    const {clearAll, setClearAll} = useContext(ClearAllContext)
    const [startHover, setStartHover] = useState(false)
    const [clearHover, setClearHover] = useState(false)
    const [deleteHover, setDeleteHover] = useState(false)
    const [color, setColor] = useState("light")

    useEffect(() => {
        const updateColor = (event: any, color: string) => {
            setColor(color)
        }
        ipcRenderer.on("update-color", updateColor)
        return () => {
            ipcRenderer.removeListener("update-color", updateColor)
        }
    }, [])

    const start = () => {
        ipcRenderer.invoke("start-all")
        setStartHover(false)
    }

    const clear = () => {
        ipcRenderer.invoke("clear-all")
        setClearHover(false)
    }

    const deleteDupes = () => {
        ipcRenderer.invoke("delete-duplicates")
        setDeleteHover(false)
    }

    const getImage = (type: string) => {
        if (type === "start") {
            if (color === "light") {
                if (startHover) {
                    return startAllButtonHover
                } else {
                    return startAllButton
                }
            } else {
                if (startHover) {
                    return startAllButtonDarkHover
                } else {
                    return startAllButtonDark
                }
            }
        } else if (type === "clear") {
            if (color === "light") {
                if (clearHover) {
                    return clearAllButtonHover
                } else {
                    return clearAllButton
                }
            } else {
                if (clearHover) {
                    return clearAllButtonDarkHover
                } else {
                    return clearAllButtonDark
                }
            }
        } else if (type === "delete") {
            if (color === "light") {
                if (deleteHover) {
                    return deleteDuplicatesButtonHover
                } else {
                    return deleteDuplicatesButton
                }
            } else {
                if (deleteHover) {
                    return deleteDuplicatesButtonDarkHover
                } else {
                    return deleteDuplicatesButtonDark
                }
            }
        }
    }

    if (clearAll) {
        return (
            <section className="group-action-container">
                    <img src={getImage("start")} onClick={start} className="group-action-button" width="319" height="61" onMouseEnter={() => setStartHover(true)} onMouseLeave={() => setStartHover(false)}/>
                    <img src={getImage("clear")} onClick={clear} className="group-action-button" width="319" height="61" onMouseEnter={() => setClearHover(true)} onMouseLeave={() => setClearHover(false)}/>
                    <img src={getImage("delete")} onClick={deleteDupes} className="group-action-button" width="462" height="61" onMouseEnter={() => setDeleteHover(true)} onMouseLeave={() => setDeleteHover(false)}/>
            </section>
        )
    }
    return null
}

export default GroupAction