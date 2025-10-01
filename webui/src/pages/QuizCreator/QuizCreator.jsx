import {useContext, useEffect, useState} from "react";
import {Link, useOutletContext} from "react-router-dom";
import {BrandingContext} from "@/common/contexts/Branding";
import {AnimatePresence, motion, Reorder} from "framer-motion";
import "./styles.sass";
import Input from "@/common/components/Input";
import {generateUuid} from "@/common/utils/UuidUtil.js";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faCloudUpload,
    faEraser,
    faExclamationTriangle,
    faFileDownload,
    faFileImport,
    faLock,
    faGraduationCap
} from "@fortawesome/free-solid-svg-icons";
import QuestionPreview from "@/pages/QuizCreator/components/QuestionPreview";
import QuestionEditor from "@/pages/QuizCreator/components/QuestionEditor";
import AddQuestion from "@/pages/QuizCreator/components/AddQuestion";
import PasswordDialog from "@/pages/QuizCreator/components/PasswordDialog";
import pako from "pako";
import toast from "react-hot-toast";
import {postRequest, putRequest} from "@/common/utils/RequestUtil.js";
import {useInputValidation, validationRules} from "@/common/hooks/useInputValidation";

export const QuizCreator = () => {
    const {setCirclePosition} = useOutletContext();
    const {titleImg, passwordProtected} = useContext(BrandingContext);
    const titleValidation = useInputValidation(localStorage.getItem("qq_title") || "", validationRules.quizTitle);

    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('quiz_password') !== null;
    });

    const [errorToastId, setErrorToastId] = useState(null);
    const [questions, setQuestions] = useState(() => {
        const stored = localStorage.getItem("qq_questions");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return parsed.map(q => ({
                    ...q,
                    type: q.type || 'single-choice'
                }));
            } catch (e) {
                console.error("Error parsing stored questions:", e);
            }
        }
        return [{uuid: generateUuid(), title: "", type: "multiple-choice", answers: []}];
    });
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

    const importQuiz = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".quizzle";
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = pako.inflate(e.target.result, {to: "string"});
                    const parsedData = JSON.parse(data);

                    if (parsedData.__type !== "QUIZZLE2") throw "Ungültiges Dateiformat.";

                    const questions = parsedData.questions.map(q => {
                        const newUuid = generateUuid();
                        return {
                            uuid: newUuid,
                            ...q,
                            type: q.type || 'multiple-choice'
                        };
                    });

                    titleValidation.setValue(parsedData.title);
                    setQuestions(questions);
                    setActiveQuestion(questions[0].uuid);
                } catch (e) {
                    toast.error("Ungültiges Dateiformat.");
                }
            }
            reader.readAsArrayBuffer(file);
        }
        input.click();
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

        if (questions.length > 50) {
            toast.error("Quiz darf maximal 50 Fragen enthalten.");
            return false;
        }

        if (questions.some(q => !q.title || q.title.trim() === "")) {
            toast.error("Fragen dürfen nicht leer sein.");
            return false;
        }

        for (const question of questions) {
            const questionType = question.type || 'multiple-choice';

            if (questionType === 'text') {
                if (!question.answers || question.answers.length === 0) {
                    toast.error("Text-Fragen müssen mindestens eine akzeptierte Antwort haben.");
                    return false;
                }
                if (question.answers.some(a => !a.content || a.content.trim() === "")) {
                    toast.error("Text-Antworten dürfen nicht leer sein.");
                    return false;
                }
                if (question.answers.length > 10) {
                    toast.error("Text-Fragen dürfen maximal 10 akzeptierte Antworten haben.");
                    return false;
                }
            } else if (questionType === 'true-false') {
                if (!question.answers || question.answers.length !== 2) {
                    toast.error("Wahr/Falsch-Fragen müssen genau zwei Antworten haben.");
                    return false;
                }
                if (!question.answers.some(a => a.is_correct)) {
                    toast.error("Wahr/Falsch-Fragen müssen mindestens eine richtige Antwort haben.");
                    return false;
                }
            } else {
                if (!question.answers || question.answers.length < 2) {
                    toast.error("Multiple-Choice-Fragen müssen mindestens zwei Antworten haben.");
                    return false;
                }
                if (question.answers.length > 6) {
                    toast.error("Multiple-Choice-Fragen dürfen maximal sechs Antworten haben.");
                    return false;
                }
                if (question.answers.filter(a => a.is_correct).length === 0) {
                    toast.error("Jede Multiple-Choice-Frage muss mindestens eine richtige Antwort haben.");
                    return false;
                }
                if (question.answers.some(a => !a.content || a.content.trim() === "")) {
                    toast.error("Multiple-Choice-Antworten dürfen nicht leer sein.");
                    return false;
                }
                if (question.answers.some(a => a.content?.trim().length > 150)) {
                    toast.error("Multiple-Choice-Antworten dürfen maximal 150 Zeichen lang sein.");
                    return false;
                }
            }
        }

        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel ist ungültig.");
            return false;
        }

        if (questions.some(q => q.title.trim().length > 200)) {
            toast.error("Fragen dürfen maximal 200 Zeichen lang sein.");
            return false;
        }

        return true;
    }

    const handlePasswordSubmit = async (password) => {
        try {
            const response = await postRequest("/quizzes/validate-password", {password});
            if (response.valid) {
                sessionStorage.setItem('quiz_password', password);
                setIsAuthenticated(true);
                setShowPasswordDialog(false);
                toast.success("Authentifizierung erfolgreich.");

                if (pendingAction === 'practice') {
                    publishPracticeQuiz();
                } else {
                    uploadQuiz();
                }
                setPendingAction(null);
            } else {
                toast.error("Ungültiges Passwort.");
            }
        } catch (error) {
            const errorMessage = error.message || "Ungültiges Passwort.";
            toast.error(errorMessage);
            console.error("Password validation error:", error);
        }
    };

    const handleUploadClick = () => {
        if (passwordProtected && !isAuthenticated) {
            setShowPasswordDialog(true);
            setPendingAction('upload');
            return;
        }
        uploadQuiz();
    };

    const handlePracticeUploadClick = () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }

        if (!validateQuestions()) return;

        if (passwordProtected && !isAuthenticated) {
            setShowPasswordDialog(true);
            setPendingAction('practice');
            return;
        }

        publishPracticeQuiz();
    };

    const publishPracticeQuiz = async () => {
        const teacherPassword = sessionStorage.getItem('quiz_password');
        const quizData = {
            title: titleValidation.value.trim(), questions: questions.map(q => {
                const {uuid, ...rest} = q;
                const cleanQuestion = {
                    ...rest,
                    title: rest.title.trim(),
                    type: rest.type || 'single-choice'
                };

                if (cleanQuestion.type === 'text') {
                    cleanQuestion.answers = rest.answers.map(a => ({
                        content: a.content.trim()
                    }));
                } else {
                    cleanQuestion.answers = rest.answers.map(a => ({
                        ...a,
                        content: a.content.trim(),
                        is_correct: a.is_correct || false
                    }));
                }

                return cleanQuestion;
            })
        };

        try {
            const response = await putRequest("/practice", quizData, {password: teacherPassword});
            if (response.practiceCode) {
                toast.success("Übungsquiz erfolgreich erstellt!");
                toast.success(`Übungscode: ${response.practiceCode}`, {duration: 10000});
                navigator.clipboard?.writeText(response.practiceCode);
            }
        } catch (error) {
            console.error('Practice quiz creation error:', error);
            toast.error("Fehler beim Erstellen des Übungsquiz.");
        }
    };

    const uploadQuiz = () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }

        if (!validateQuestions()) return;

        const quizData = {
            title: titleValidation.value.trim(), questions: questions.map(q => {
                const {uuid, ...rest} = q;
                const cleanQuestion = {
                    ...rest,
                    title: rest.title.trim(),
                    type: rest.type || 'single-choice'
                };

                if (cleanQuestion.type === 'text') {
                    cleanQuestion.answers = rest.answers.map(a => ({
                        content: a.content.trim()
                    }));
                } else {
                    cleanQuestion.answers = rest.answers.map(a => ({
                        ...a,
                        content: a.content.trim(),
                        is_correct: a.is_correct || false
                    }));
                }

                return cleanQuestion;
            })
        };

        const headers = {};
        if (passwordProtected) {
            headers['X-Quiz-Password'] = sessionStorage.getItem('quiz_password');
        }

        putRequest("/quizzes", quizData, headers).then((r) => {
            if (r.quizId === undefined) throw {ce: "Dein Quiz übersteigt die Speicherkapazität des Servers. Bitte lade es lokal herunter."};
            toast.success("Quiz erfolgreich hochgeladen.");
            toast.success("Quiz-ID: " + r.quizId, {duration: 10000});

            navigator.clipboard?.writeText(r.quizId);
        }).catch((e) => {
            console.log(e)
            toast.error(e?.ce ? e.ce : "Fehler beim Hochladen des Quiz.");
        });
    }

    const downloadQuiz = () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }

        if (!validateQuestions()) return;

        const quizData = JSON.stringify({
            __type: "QUIZZLE2", title: titleValidation.value.trim(), questions: questions.map(q => {
                const {uuid, ...rest} = q;
                const cleanQuestion = {
                    ...rest,
                    title: rest.title.trim(),
                    type: rest.type || 'single-choice'
                };

                if (cleanQuestion.type === 'text') {
                    cleanQuestion.answers = rest.answers.map(a => ({
                        content: a.content.trim()
                    }));
                } else {
                    cleanQuestion.answers = rest.answers.map(a => ({
                        ...a,
                        content: a.content.trim(),
                        is_correct: a.is_correct || false
                    }));
                }

                return cleanQuestion;
            })
        });

        const compressedData = pako.deflate(quizData, {to: "string"});
        const blob = new Blob([compressedData], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = titleValidation.value.trim() + ".quizzle";
        a.click();
        URL.revokeObjectURL(url);
    }

    const addQuestion = () => {
        const uuid = generateUuid();
        setQuestions([...questions, {uuid: uuid, title: "", type: "multiple-choice", answers: []}]);
        setActiveQuestion(uuid);
    }

    const onChange = (newQuestion) => {
        setQuestions(questions.map(q => q.uuid === activeQuestion ? newQuestion : q));
    }

    const clearQuiz = () => {
        const newUuid = generateUuid();
        titleValidation.reset();
        setQuestions([{uuid: newUuid, title: "", type: "multiple-choice", answers: []}]);
        setActiveQuestion(newUuid);

        localStorage.removeItem("qq_title");
        localStorage.removeItem("qq_questions");
    }

    useEffect(() => {
        setCirclePosition(["-25rem -25rem auto auto", "-15rem -7rem auto auto"]);

        if (passwordProtected && sessionStorage.getItem('quiz_password')) {
            setIsAuthenticated(true);
        }
    }, [passwordProtected]);

    useEffect(() => {
        try {
            localStorage.setItem("qq_title", titleValidation.value);
            localStorage.setItem("qq_questions", JSON.stringify(questions));

            if (errorToastId) {
                toast.dismiss(errorToastId);
                setErrorToastId(null);
            }
        } catch (e) {
            if (!errorToastId) {
                setErrorToastId(toast.error("Dein Quiz übersteigt die lokale Speicherkapazität. Bitte lade es hoch, um zu verhindern, dass es verloren geht wenn du die Seite verlässt.",
                    {
                        duration: Infinity,
                        icon: <FontAwesomeIcon color={"#FFA500"} icon={faExclamationTriangle} size="lg"/>
                    }));
            }
        }

    }, [titleValidation.value, questions]);

    return (
        <div className="quiz-creator">
            <div className="quiz-header-area">
                <Link to="/">
                    <motion.img src={titleImg} alt="logo" initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}/>
                </Link>
                <motion.div initial={{opacity: 0, x: -50}} animate={{opacity: 1, x: 0}} className="quiz-title-area">
                    <Input
                        placeholder="Quiz-Titel eingeben"
                        value={titleValidation.value}
                        onChange={(e) => titleValidation.setValue(e.target.value)}
                        onBlur={titleValidation.onBlur}
                        error={titleValidation.error}
                        warning={titleValidation.warning}
                        maxLength={validationRules.quizTitle.maxLength}
                    />
                    <div className="quiz-action-area">
                        <FontAwesomeIcon icon={faFileImport} onClick={importQuiz} className="import-icon"/>
                        <FontAwesomeIcon
                            icon={passwordProtected && !isAuthenticated ? faLock : faCloudUpload}
                            onClick={handleUploadClick}
                            className={passwordProtected && !isAuthenticated ? "locked" : ""}
                            title="Als Live-Quiz hochladen"
                        />
                        <FontAwesomeIcon
                            icon={faGraduationCap}
                            onClick={handlePracticeUploadClick}
                            className={passwordProtected && !isAuthenticated ? "locked" : "practice-upload"}
                            title="Als Übungsquiz veröffentlichen"
                        />
                        <FontAwesomeIcon icon={faFileDownload} onClick={downloadQuiz}/>
                        {(titleValidation.value !== "" || questions.some(q => q.title !== "") || questions.length > 1 ||
                                questions.some(q => q.answers.length > 0)) &&
                            <FontAwesomeIcon icon={faEraser} onClick={clearQuiz}/>}
                    </div>
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

            <PasswordDialog
                isOpen={showPasswordDialog}
                onClose={() => setShowPasswordDialog(false)}
                onConfirm={handlePasswordSubmit}
            />
        </div>
    )
}