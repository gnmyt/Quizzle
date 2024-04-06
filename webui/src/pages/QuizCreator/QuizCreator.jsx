import {useContext, useEffect, useState} from "react";
import {Link, useOutletContext} from "react-router-dom";
import {BrandingContext} from "@/common/contexts/Branding";
import {AnimatePresence, motion, Reorder} from "framer-motion";
import "./styles.sass";
import Input from "@/common/components/Input";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCloudUpload, faEraser, faExclamationTriangle, faFileDownload} from "@fortawesome/free-solid-svg-icons";
import QuestionPreview from "@/pages/QuizCreator/components/QuestionPreview";
import QuestionEditor from "@/pages/QuizCreator/components/QuestionEditor";
import AddQuestion from "@/pages/QuizCreator/components/AddQuestion";
import pako from "pako";
import toast from "react-hot-toast";
import {putRequest} from "@/common/utils/RequestUtil.js";

export const QuizCreator = () => {
    const {setCirclePosition} = useOutletContext();
    const {titleImg} = useContext(BrandingContext);

    const generateUuid = () => {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    const [errorToastId, setErrorToastId] = useState(null);
    const [title, setTitle] = useState(localStorage.getItem("qq_title") || "");
    const [questions, setQuestions] = useState(localStorage.getItem("qq_questions") ? JSON.parse(localStorage.getItem("qq_questions")) :
        [{uuid: generateUuid(), title: "", answers: []}]);
    const [activeQuestion, setActiveQuestion] = useState(questions[0].uuid);

    const deleteQuestion = (uuid) => {
        const questionIndex = questions.findIndex(q => q.uuid === uuid);
        const newQuestions = questions.filter(q => q.uuid !== uuid);

        if (questions.length === 1) {
            clearQuiz();
            return;
        }
        if (questionIndex === 0) setActiveQuestion(newQuestions[0].uuid);
        if (questionIndex > 0) setActiveQuestion(newQuestions[questionIndex - 1].uuid);

        setQuestions(newQuestions);
    }

    const duplicateQuestion = (uuid) => {
        const question = questions.find(q => q.uuid === uuid);
        const newUuid = generateUuid();
        const newQuestion = {...question, uuid: newUuid};
        const questionIndex = questions.findIndex(q => q.uuid === uuid);

        const newQuestions = [...questions];
        newQuestions.splice(questionIndex + 1, 0, newQuestion);

        setActiveQuestion(newUuid);
        setQuestions(newQuestions);
    }

    const validateQuestions = () => {
        if (questions.length === 0) {
            toast.error("Es muss mindestens eine Frage vorhanden sein.");
            return false;
        }

        if (questions.some(q => q.title === "")) {
            toast.error("Fragen dürfen nicht leer sein.");
            return false;
        }

        if (questions.some(q => q.answers.length < 2)) {
            toast.error("Fragen müssen mindestens zwei Antworten haben.");
            return false;
        }

        if (questions.some(q => q.answers.filter(a => a.is_correct).length === 0)) {
            toast.error("Jede Frage muss mindestens eine richtige Antwort haben.");
            return false;
        }

        if (title.length > 100) {
            toast.error("Quiz-Titel darf maximal 100 Zeichen lang sein.");
            return false;
        }

        if (questions.some(q => q.title.length > 100)) {
            toast.error("Fragen dürfen maximal 100 Zeichen lang sein.");
            return false;
        }

        if (questions.some(q => q.answers.some(a => a.title?.length > 100))) {
            toast.error("Antworten dürfen maximal 100 Zeichen lang sein.");
            return false;
        }

        return true;
    }

    const uploadQuiz = () => {
        if (!title) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }

        if (!validateQuestions()) return;

        const quizData = {title, questions: questions.map(q => {
            const {uuid, ...rest} = q;
            return rest;
        })};

        putRequest("/quizzes", quizData).then((r) => {
            if (r.quizId === undefined) throw {ce: "Dein Quiz übersteigt die Speicherkapazität des Servers. Bitte lade es lokal herunter."};
            toast.success("Quiz erfolgreich hochgeladen.");
            toast.success("Quiz-ID: " + r.quizId, {duration: 10000});

            navigator.clipboard.writeText(r.quizId);
        }).catch((e) => {
            toast.error(e?.ce ? e.ce : "Fehler beim Hochladen des Quiz.");
        });
    }

    const downloadQuiz = () => {
        if (!title) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }

        if (!validateQuestions()) return;

        const quizData = JSON.stringify({__type: "QUIZZLE1", title, questions: questions.map(q => {
            const {uuid, ...rest} = q;
            return rest;
        })});

        const compressedData = pako.deflate(quizData, {to: "string"});
        const blob = new Blob([compressedData], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = title + ".quizzle";
        a.click();
        URL.revokeObjectURL(url);
    }

    const addQuestion = () => {
        const uuid = generateUuid();
        setQuestions([...questions, {uuid: uuid, title: "", answers: []}]);
        setActiveQuestion(uuid);
    }

    const onChange = (newQuestion) => {
        setQuestions(questions.map(q => q.uuid === activeQuestion ? newQuestion : q));
    }

    const clearQuiz = () => {
        const newUuid = generateUuid();
        setTitle("");
        setQuestions([{uuid: newUuid, title: "", answers: []}]);
        setActiveQuestion(newUuid);

        localStorage.removeItem("qq_title");
        localStorage.removeItem("qq_questions");
    }

    useEffect(() => {
        setCirclePosition(["-25rem -25rem auto auto", "-15rem -7rem auto auto"]);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("qq_title", title);
            localStorage.setItem("qq_questions", JSON.stringify(questions));

            if (errorToastId) {
                toast.dismiss(errorToastId);
                setErrorToastId(null);
            }
        } catch (e) {
            //set permanent error toast

            if (!errorToastId) {
                setErrorToastId(toast.error("Dein Quiz übersteigt die lokale Speicherkapazität. Bitte lade es hoch, um zu verhindern, dass es verloren geht wenn du die Seite verlässt.",
                    {duration: Infinity,
                    icon: <FontAwesomeIcon color={"#FFA500"} icon={faExclamationTriangle} size="lg" />}));
            }
        }

    }, [title, questions]);

    return (
        <div className="quiz-creator">
            <div className="quiz-header-area">
                <Link to="/">
                    <motion.img src={titleImg} alt="logo" initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}/>
                </Link>
                <motion.div initial={{opacity: 0, x: -50}} animate={{opacity: 1, x: 0}} className="quiz-title-area">
                    <Input placeholder="Quiz-Titel eingeben" value={title} onChange={(e) => setTitle(e.target.value)}/>
                    <FontAwesomeIcon icon={faCloudUpload} onClick={uploadQuiz}/>
                    <FontAwesomeIcon icon={faFileDownload} onClick={downloadQuiz}/>
                    {(title !== "" || questions.some(q => q.title !== "") || questions.length > 1 ||
                            questions.some(q => q.answers.length > 0)) &&
                        <FontAwesomeIcon icon={faEraser} onClick={clearQuiz}/>}
                </motion.div>
            </div>

            <div className="question-area">

                <motion.div className="question-list"
                            initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}>
                    <Reorder.Group
                        as="div"
                        className="questions"
                        values={questions}
                        whileDrag={{scale: 1.05}}
                        onReorder={setQuestions}>
                        <AnimatePresence initial={false}>
                            {questions.map((question, index) => (
                                <Reorder.Item key={question.uuid} value={question} style={{listStyleType: "none"}}>
                                    <motion.div initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}>
                                        <QuestionPreview question={question.title} index={index}
                                                         isActive={activeQuestion === question.uuid}
                                                         onClick={() => setActiveQuestion(question.uuid)}/>
                                    </motion.div>
                                </Reorder.Item>
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                    <AddQuestion onClick={addQuestion}/>
                </motion.div>

                <QuestionEditor question={questions.find(q => q.uuid === activeQuestion)} onChange={onChange}
                                deleteQuestion={deleteQuestion} duplicateQuestion={duplicateQuestion}/>
            </div>
        </div>
    )
}