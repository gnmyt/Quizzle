import {useContext, useEffect, useState} from "react";
import {Link, useNavigate, useOutletContext} from "react-router-dom";
import {BrandingContext} from "@/common/contexts/Branding";
import UploadImage from "@/common/assets/images/upload.svg";
import "./styles.sass";
import Input from "@/common/components/Input";
import Button from "@/common/components/Button";
import {faFileImport, faFileUpload, faPlay} from "@fortawesome/free-solid-svg-icons";
import {QuizContext} from "@/common/contexts/Quiz";
import toast from "react-hot-toast";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

export const QuizLoader = () => {
    const {setCirclePosition} = useOutletContext();
    const {titleImg, name} = useContext(BrandingContext);
    const {loadQuizById, loadQuizByContent} = useContext(QuizContext);
    const [dragActive, setDragActive] = useState(false);
    const query = new URLSearchParams(window.location.search);

    const navigate = useNavigate();

    const [quizId, setQuizId] = useState(query.get("id") || "");

    const runImport = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const isLoaded = loadQuizByContent(e.target.result);
                if (!isLoaded) throw new Error("Invalid file format.");

                toast.success("Quiz erfolgreich geladen!");
                setCirclePosition(["-18rem 0 0 45%", "-35rem 0 0 55%"]);
                setTimeout(() => navigate("/host"), 500);
            } catch (e) {
                toast.error("Ungültiges Dateiformat.");
            }
        }
        reader.readAsArrayBuffer(file);
    }

    const importQuiz = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".quizzle";
        input.onchange = (e) => {
            const file = e.target.files[0];
            runImport(file);
        }
        input.click();
    }

    const loadQuiz = async () => {
        const res = await loadQuizById(quizId);
        if (!res){
            toast.error(`Quiz-ID nicht gefunden. Versichere dich, dass du die richtige ID eingegeben hast und das Quiz auf der Instanz von ${name} läuft.`);
            return;
        }

        toast.success("Quiz erfolgreich geladen!");
        setCirclePosition(["-18rem 0 0 45%", "-35rem 0 0 55%"]);
        setTimeout(() => navigate("/host"), 500);
    }

    const onDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        try {
            const file = e.dataTransfer.files[0];
            runImport(file);
        } catch (e) {
            toast.error("Ungültiges Dateiformat.");
        }
    }

    useEffect(() => {
        setCirclePosition(["-35rem 0 0 55%", "-18rem 0 0 45%"]);
    }, []);
    return (
        <div className="loader-page" onDrop={onDrop} onDragOver={(e) => {e.preventDefault();
            setDragActive(true);}} onDragLeave={() => setDragActive(false)}>
            {dragActive && <div className="drag-overlay">
                <div className="drag-container">
                    <FontAwesomeIcon icon={faFileImport} size="3x"/>
                    <h2>Datei hier ablegen</h2>
                </div>
            </div>}
            <div className="quiz-loader">
                <Link to="/"><img src={titleImg} alt="logo"/></Link>

                <div className="code-input">
                    <Input placeholder="Quiz-ID (z. B. JWTIOI)" value={quizId} onChange={(e) => setQuizId(e.target.value)}/>
                    <Button icon={faPlay} padding="0.8rem 1.5rem" onClick={loadQuiz} />
                </div>

                <div className="alternative">
                    <hr/>
                    <h2>oder</h2>
                    <hr/>
                </div>

                <Button icon={faFileUpload} text="Datei hochladen" padding="0.8rem 1.5rem"
                        onClick={importQuiz}/>
            </div>
            <img src={UploadImage} alt="upload" className="upload-image"/>
        </div>
    );
}