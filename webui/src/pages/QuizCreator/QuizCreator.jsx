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
    faGraduationCap
} from "@fortawesome/free-solid-svg-icons";
import QuestionPreview from "@/pages/QuizCreator/components/QuestionPreview";
import QuestionEditor from "@/pages/QuizCreator/components/QuestionEditor";
import AddQuestion from "@/pages/QuizCreator/components/AddQuestion";
import PasswordDialog from "@/common/components/PasswordDialog";
import toast from "react-hot-toast";
import {putRequest} from "@/common/utils/RequestUtil.js";
import {useInputValidation, validationRules} from "@/common/hooks/useInputValidation";
import {prepareQuizData, prepareQuizDataForExport, cleanupQuestionImages, cleanupSingleQuestionImages} from "@/common/utils/QuizDataUtil.js";
import {createFileInput, importQuizzleFile, downloadQuizzleFile} from "@/common/utils/FileOperationsUtil.js";
import {QuizValidationUtil} from "@/common/utils/QuizValidationUtil.js";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import {usePasswordAuthentication} from "@/common/hooks/usePasswordAuthentication.js";
import {DEFAULT_QUESTION_TYPE} from "@/common/constants/QuestionTypes.js";

export const QuizCreator = () => {
    const {setCirclePosition} = useOutletContext();
    const {titleImg} = useContext(BrandingContext);
    const titleValidation = useInputValidation(localStorage.getItem("qq_title") || "", validationRules.quizTitle);
    const {
        isAuthenticated,
        passwordProtected,
        showPasswordDialog,
        requireAuthentication,
        handlePasswordSubmit,
        closePasswordDialog,
        getAuthHeaders,
        getAuthData
    } = usePasswordAuthentication();

    const [errorToastId, setErrorToastId] = useState(null);
    const [questions, setQuestions] = useState(() => {
        const stored = localStorage.getItem("qq_questions");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return parsed.map(q => {
                    const { b64_image, ...cleanQuestion } = q;

                    if (cleanQuestion.answers) {
                        cleanQuestion.answers = cleanQuestion.answers.map(answer => {
                            const { b64_image: answerB64, ...cleanAnswer } = answer;
                            return {
                                ...cleanAnswer,
                                type: cleanAnswer.type || QUESTION_TYPES.TEXT
                            };
                        });
                    }
                    
                    return {
                        ...cleanQuestion,
                        type: cleanQuestion.type || DEFAULT_QUESTION_TYPE
                    };
                });
            } catch (e) {
                console.error("Error parsing stored questions:", e);
            }
        }
        return [{uuid: generateUuid(), title: "", type: DEFAULT_QUESTION_TYPE, answers: []}];
    });
    const [activeQuestion, setActiveQuestion] = useState(questions[0].uuid);

    const deleteQuestion = async (uuid) => {
        const questionToDelete = questions.find(q => q.uuid === uuid);
        const questionIndex = questions.findIndex(q => q.uuid === uuid);
        const newQuestions = questions.filter(q => q.uuid !== uuid);

        if (questionToDelete) {
            await cleanupSingleQuestionImages(questionToDelete);
        }

        if (questions.length === 1) {
            clearQuiz();
            return;
        }
        if (questionIndex === 0) setActiveQuestion(newQuestions[0].uuid);
        if (questionIndex > 0) setActiveQuestion(newQuestions[questionIndex - 1].uuid);

        setQuestions(newQuestions);
    }

    const importQuiz = () => {
        createFileInput(".quizzle", async (file) => {
            try {
                const importedData = await importQuizzleFile(file);
                titleValidation.setValue(importedData.title);
                setQuestions(importedData.questions);
                setActiveQuestion(importedData.questions[0].uuid);
                toast.success("Quiz erfolgreich importiert!");
            } catch (error) {
                toast.error(error.message || "Ungültiges Dateiformat.");
            }
        });
    }

    const duplicateQuestion = (uuid) => {
        const question = questions.find(q => q.uuid === uuid);
        const newUuid = generateUuid();
        const { imageId, b64_image, ...questionWithoutImage } = question;

        const cleanAnswers = questionWithoutImage.answers ? questionWithoutImage.answers.map(answer => {
            const { imageId, ...answerWithoutImage } = answer;
            return answerWithoutImage.type === "image" ? { ...answerWithoutImage, type: "text", content: "" } : answerWithoutImage;
        }) : [];
        
        const newQuestion = {...questionWithoutImage, uuid: newUuid, answers: cleanAnswers};
        const questionIndex = questions.findIndex(q => q.uuid === uuid);
        const newQuestions = [...questions];
        newQuestions.splice(questionIndex + 1, 0, newQuestion);
        setActiveQuestion(newUuid);
        setQuestions(newQuestions);
    }

    const validateQuestions = () => {
        const validation = QuizValidationUtil.validateQuiz(questions, titleValidation.value);
        if (!validation.isValid) {
            toast.error(validation.error);
            return false;
        }
        return true;
    }

    const handleUploadClick = () => {
        requireAuthentication(uploadQuiz, 'upload');
    };

    const handlePracticeUploadClick = () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }
        if (!validateQuestions()) return;
        requireAuthentication(publishPracticeQuiz, 'practice');
    };

    const publishPracticeQuiz = async () => {
        const quizData = await prepareQuizData(questions, titleValidation.value, true);
        try {
            const authData = getAuthData();
            const response = await putRequest("/practice", quizData, authData);
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

    const uploadQuiz = async () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }
        if (!validateQuestions()) return;

        const quizData = await prepareQuizData(questions, titleValidation.value, true);
        const headers = getAuthHeaders();

        putRequest("/quizzes", quizData, headers).then((r) => {
            if (r.quizId === undefined) throw {ce: "Dein Quiz übersteigt die Speicherkapazität des Servers. Bitte lade es lokal herunter."};
            toast.success("Quiz erfolgreich hochgeladen.");
            toast.success("Quiz-ID: " + r.quizId, {duration: 10000});
            navigator.clipboard?.writeText(r.quizId);
        }).catch((e) => {
            toast.error(e?.ce ? e.ce : "Fehler beim Hochladen des Quiz.");
        });
    }

    const downloadQuiz = async () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }
        if (!validateQuestions()) return;

        const quizData = await prepareQuizDataForExport(questions, titleValidation.value);
        downloadQuizzleFile(quizData, titleValidation.value.trim());
    }

    const addQuestion = () => {
        const uuid = generateUuid();
        setQuestions([...questions, {uuid: uuid, title: "", type: DEFAULT_QUESTION_TYPE, answers: []}]);
        setActiveQuestion(uuid);
    }

    const onChange = (newQuestion) => setQuestions(questions.map(q => q.uuid === activeQuestion ? newQuestion : q));

    const clearQuiz = async () => {
        await cleanupQuestionImages(questions);
        const newUuid = generateUuid();
        titleValidation.reset();
        setQuestions([{uuid: newUuid, title: "", type: DEFAULT_QUESTION_TYPE, answers: []}]);
        setActiveQuestion(newUuid);
        localStorage.removeItem("qq_title");
        localStorage.removeItem("qq_questions");
    }

    useEffect(() => {
        setCirclePosition(["-25rem -25rem auto auto", "-15rem -7rem auto auto"]);
    }, []);

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
                        className="quiz-title-input"
                        placeholder="Quiz-Titel eingeben"
                        value={titleValidation.value}
                        onChange={(e) => titleValidation.setValue(e.target.value)}
                        onBlur={titleValidation.onBlur}
                        error={titleValidation.error}
                        warning={titleValidation.warning}
                        maxLength={validationRules.quizTitle.maxLength}
                    />
                    <div className="quiz-action-area">
                        <div className="action-group">
                            <div 
                                className="action-button import" 
                                onClick={importQuiz}
                                title="Quiz aus Datei importieren"
                            >
                                <FontAwesomeIcon icon={faFileImport} />
                            </div>
                            <div 
                                className="action-button download" 
                                onClick={downloadQuiz}
                                title="Quiz als Datei herunterladen"
                            >
                                <FontAwesomeIcon icon={faFileDownload} />
                            </div>
                        </div>
                        
                        <div className="action-group">
                            <div 
                                className={`action-button upload ${passwordProtected && !isAuthenticated ? 'locked' : ''}`}
                                onClick={handleUploadClick}
                                title={passwordProtected && !isAuthenticated ? "Passwort erforderlich" : "Als Live-Quiz hochladen"}
                            >
                                <FontAwesomeIcon icon={faCloudUpload} />
                            </div>
                            <div 
                                className={`action-button practice ${passwordProtected && !isAuthenticated ? 'locked' : ''}`}
                                onClick={handlePracticeUploadClick}
                                title={passwordProtected && !isAuthenticated ? "Passwort erforderlich" : "Als Übungsquiz veröffentlichen"}
                            >
                                <FontAwesomeIcon icon={faGraduationCap} />
                            </div>
                        </div>

                        {(titleValidation.value !== "" || questions.some(q => q.title !== "") || questions.length > 1 ||
                                questions.some(q => q.answers.length > 0)) && (
                            <div 
                                className="action-button clear" 
                                onClick={clearQuiz}
                                title="Quiz zurücksetzen"
                            >
                                <FontAwesomeIcon icon={faEraser} />
                            </div>
                        )}
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

                <QuestionEditor key={activeQuestion} question={questions.find(q => q.uuid === activeQuestion)}
                    onChange={onChange} deleteQuestion={deleteQuestion} duplicateQuestion={duplicateQuestion} />
            </div>

            <PasswordDialog
                isOpen={showPasswordDialog}
                onClose={closePasswordDialog}
                onConfirm={handlePasswordSubmit}
            />
        </div>
    )
}