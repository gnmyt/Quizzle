import {BrandingContext} from "@/common/contexts/Branding";
import {useContext, useEffect, useRef, useState} from "react";
import "./styles.sass";
import {motion} from "framer-motion";
import Button from "@/common/components/Button";
import {faShareFromSquare, faSwatchbook} from "@fortawesome/free-solid-svg-icons";
import {useNavigate, useOutletContext} from "react-router-dom";
import {socket} from "@/common/utils/SocketUtil.js";
import CodeInput from "@/pages/Home/components/CodeInput";
import CharacterSelection from "@/pages/Home/components/CharacterSelection";
import {QuizContext} from "@/common/contexts/Quiz";
import QrScanner from "qr-scanner";

export const Home = () => {
    const {titleImg, imprint, privacy} = useContext(BrandingContext);
    const {setRoomCode, setUsername} = useContext(QuizContext);
    const {setCirclePosition} = useOutletContext();
    const [code, setCode] = useState(window.location.search.includes("code=") ? parseInt(window.location.search.split("=")[1]) : -1);
    const [scannerShown, setScannerShown] = useState(false);

    const scanner = useRef();
    const videoEl = useRef(null);
    const qrBoxEl = useRef(null);

    const handleScan = ({data}) => {
        if (data) {
            stopScan();
            const code = data.split("/?code=")[1];
            if (code) {
                setCode(parseInt(code));
            }
        }
    }

    const scanQr = () => {
        if (videoEl?.current && !scanner.current) {
            scanner.current = new QrScanner(videoEl?.current, handleScan, {
                preferredCamera: "environment",
                highlightScanRegion: true,
                highlightCodeOutline: true,
                overlay: qrBoxEl?.current || undefined,
            });

            scanner?.current?.start()
                .then(() => setScannerShown(true))
                .catch((err) => {
                    if (err) setScannerShown(false);
                });
        }
    }

    const stopScan = () => {
        if (scanner.current) {
            scanner.current?.stop();
            scanner.current = null;
        }

        setScannerShown(false);
    }
    const [errorClass, setErrorClass] = useState("");

    const checkRoom = (code) => {
        socket.emit("CHECK_ROOM", {code}, (success) => {
            if (success) setCode(code);

            if (!success) {
                setCode(-1);
                setErrorClass("room-error");
                setTimeout(() => setErrorClass(""), 300);
            }
        });
    }

    const joinGame = (name, character) => {
        socket.emit("JOIN_ROOM", {code: parseInt(code), name, character}, (success) => {
            if (success) {
                setCirclePosition("-30rem 0 0 -30rem");
                setUsername(name);
                setRoomCode(code);
                setTimeout(() => navigate("/client"), 500);
            }
        });
    }

    const navigate = useNavigate();

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);

        if (code !== -1) {
            checkRoom(code);
        }
    }, []);

    return (
        <div className="home-page">
            <motion.div className="legal-area" initial={{opacity: 0, y: 50}} animate={{opacity: 1, y: 0}}>
                <a href={imprint} target="_blank" rel="noreferrer">Impressum</a>
                <a href={privacy} target="_blank" rel="noreferrer">Datenschutz</a>
            </motion.div>

            <div className={"scan-dialog" + (scannerShown ? " scanner-shown" : "")} onClick={() => stopScan()}>
                <div className="qr-reader">
                    <video ref={videoEl}></video>
                </div>
            </div>

            <motion.img src={titleImg} alt="logo" initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}/>

            <motion.div initial={{opacity: 0, y: 50}} animate={{opacity: 1, y: 0}} transition={{delay: 0.5}}
                        className="home-content">
                <div className="join-area">
                    {code === -1 ? <CodeInput joinGame={checkRoom} errorClass={errorClass} scanQr={scanQr}/>
                        : <CharacterSelection code={code} submit={joinGame}/>}
                </div>
                <div className={`action-area ${code !== -1 ? 'disabled' : ''}`}>
                    <Button text="Quiz erstellen" icon={faSwatchbook} padding={"0.8rem 2.5rem"}
                            disabled={code !== -1}
                            onClick={() => {
                                setCirclePosition("-30rem 0 0 -30rem");
                                setTimeout(() => navigate("/create"), 500);
                            }}/>
                    <Button text="Raum hosten" icon={faShareFromSquare} padding={"0.8rem 2.5rem"}
                            disabled={code !== -1}
                            onClick={() => {
                                setCirclePosition("-30rem 0 0 -30rem");
                                setTimeout(() => navigate("/load"), 500);
                            }}/>
                </div>
            </motion.div>
        </div>
    )
}