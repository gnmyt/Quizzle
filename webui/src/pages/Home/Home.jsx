import {BrandingContext} from "@/common/contexts/Branding";
import {useContext, useEffect, useRef, useState} from "react";
import "./styles.sass";
import {motion} from "framer-motion";
import Button from "@/common/components/Button";
import {faShareFromSquare, faSwatchbook, faChartBar} from "@fortawesome/free-solid-svg-icons";
import {useNavigate, useOutletContext} from "react-router-dom";
import {socket, ensureSocketConnection, joinRoomWithSession, addReconnectionCallback, removeReconnectionCallback} from "@/common/utils/SocketUtil.js";
import CodeInput from "@/pages/Home/components/CodeInput";
import CharacterSelection from "@/pages/Home/components/CharacterSelection";
import ResultsDialog from "@/pages/Home/components/ResultsDialog";
import {QuizContext} from "@/common/contexts/Quiz";
import QrScanner from "qr-scanner";
import toast from "react-hot-toast";
import {jsonRequest} from "@/common/utils/RequestUtil.js";

export const Home = () => {
    const {titleImg, imprint, privacy} = useContext(BrandingContext);
    const {setRoomCode, setUsername} = useContext(QuizContext);
    const {setCirclePosition} = useOutletContext();
    const [code, setCode] = useState(window.location.search.includes("code=") ? window.location.search.split("=")[1] : null);
    const [scannerShown, setScannerShown] = useState(false);
    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [showResultsDialog, setShowResultsDialog] = useState(false);

    const scanner = useRef();
    const videoEl = useRef(null);
    const qrBoxEl = useRef(null);

    const isNumericCode = (code) => /^\d{4}$/.test(code);
    const isAlphabeticCode = (code) => /^[A-Z]{4}$/i.test(code);

    const handleScan = ({data}) => {
        if (data) {
            stopScan();
            const code = data.split("/?code=")[1];
            if (code) {
                setCode(code);
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
    const [loading, setLoading] = useState(false);

    const checkRoom = (code) => {
        if (isAlphabeticCode(code)) {
            setLoading(true);
            jsonRequest(`/practice/${code.toUpperCase()}/exists`)
                .then(data => {
                    setLoading(false);
                    if (data.exists) {
                        setCode(code.toUpperCase());
                        setIsPracticeMode(true);
                    } else {
                        setCode(null);
                        toast.error(data.message || "Übungsquiz nicht gefunden");
                        setErrorClass("room-error");
                        setTimeout(() => setErrorClass(""), 300);
                    }
                })
                .catch(error => {
                    setLoading(false);
                    console.error('Error checking practice quiz:', error);
                    setCode(null);
                    toast.error("Fehler beim Überprüfen des Übungsquiz");
                    setErrorClass("room-error");
                    setTimeout(() => setErrorClass(""), 300);
                });
            return;
        }

        if (isNumericCode(code)) {
            ensureSocketConnection().then(() => {
                socket.emit("CHECK_ROOM", {code: parseInt(code)}, (response) => {
                    if (response?.success && response?.exists && !response?.isPractice) {
                        setCode(parseInt(code));
                        setIsPracticeMode(false);
                    } else {
                        setCode(null);
                        toast.error(response?.error || "Raum nicht gefunden");
                        setErrorClass("room-error");
                        setTimeout(() => setErrorClass(""), 300);
                    }
                });
            }).catch(() => {
                setCode(null);
                toast.error("Verbindungsfehler");
                setErrorClass("room-error");
                setTimeout(() => setErrorClass(""), 300);
            });
        } else {
            setCode(null);
            toast.error("Ungültiger Code");
            setErrorClass("room-error");
            setTimeout(() => setErrorClass(""), 300);
        }
    }

    const joinRoom = async (name, character, code) => {
        setLoading(true);

        return new Promise((resolve, reject) => {
            if (isPracticeMode) {
                setCirclePosition("-30rem 0 0 -30rem");
                setTimeout(() => {
                    navigate(`/practice/${code}`);
                    setLoading(false);
                }, 500);
                resolve();
            } else {
                joinRoomWithSession(parseInt(code), name, character)
                    .then(() => {
                        setCirclePosition("-30rem 0 0 -30rem");
                        setUsername(name);
                        setRoomCode(code);
                        setTimeout(() => {
                            navigate("/client");
                            setLoading(false);
                        }, 500);
                        resolve();
                    })
                    .catch((error) => {
                        setLoading(false);
                        toast.error(error.message || "Fehler beim Beitreten");
                        reject(error);
                    });
            }
        });
    }

    const handleResultsSuccess = (practiceCode, password) => {
        setCirclePosition("-30rem 0 0 -30rem");
        setTimeout(() => {
            navigate(`/results/${practiceCode}`, {
                state: {password}
            });
        }, 500);
    };

    const navigate = useNavigate();

    useEffect(() => {
        setCirclePosition(["-25rem 0 0 -25rem", "-8rem 0 0 -8rem"]);

        if (!window.location.search.includes("code=")) {
            setCode(null);
            setIsPracticeMode(false);
        }

        if (code && code !== null) {
            checkRoom(code.toString());
        }
    }, []);

    useEffect(() => {
        const handleConnect = () => {
            // Connection restored, no need to clear error messages since we're using toasts
        };

        const handleDisconnect = () => {
            console.log('Socket disconnected in Home');
        };

        const handleReconnection = (success, error) => {
            if (success) {
                console.log('Successfully reconnected from Home page');
            } else if (error) {
                console.warn('Reconnection failed in Home page:', error);
            }
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        addReconnectionCallback(handleReconnection);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            removeReconnectionCallback(handleReconnection);
        };
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
                    {code === null ? <CodeInput joinGame={checkRoom} errorClass={errorClass} scanQr={scanQr}/>
                        : <CharacterSelection code={code} submit={joinRoom} isPracticeMode={isPracticeMode}/>}
                    {code !== null && isPracticeMode && (
                        <div className="result-area">
                            <div className="alternative">
                                <hr/>
                                <h2>oder</h2>
                                <hr/>
                            </div>
                            <Button
                                text="Ergebnisse einsehen"
                                icon={faChartBar}
                                onClick={() => setShowResultsDialog(true)}
                                variant="secondary"
                                padding="0.6rem 1.2rem"
                            />
                        </div>
                    )}
                </div>
                <div className={`action-area ${code !== null ? 'disabled' : ''}`}>
                    <Button text="Quiz erstellen" icon={faSwatchbook} padding={"0.8rem 2.5rem"}
                            disabled={code !== null}
                            onClick={() => {
                                setCirclePosition("-30rem 0 0 -30rem");
                                setTimeout(() => navigate("/create"), 500);
                            }}/>
                    <Button text="Raum hosten" icon={faShareFromSquare} padding={"0.8rem 2.5rem"}
                            disabled={code !== null}
                            onClick={() => {
                                setCirclePosition("-30rem 0 0 -30rem");
                                setTimeout(() => navigate("/load"), 500);
                            }}/>
                </div>
            </motion.div>

            <ResultsDialog
                isOpen={showResultsDialog}
                onClose={() => setShowResultsDialog(false)}
                practiceCode={code}
                onSuccess={handleResultsSuccess}
            />
        </div>
    )
}