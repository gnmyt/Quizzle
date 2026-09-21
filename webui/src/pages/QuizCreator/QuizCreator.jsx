import {useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
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
    faGear,
    faGraduationCap,
    faRotateLeft,
    faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import {useUndoRedo} from "@/common/hooks/useUndoRedo.js";
import {useKeyboardShortcuts} from "@/common/hooks/useKeyboardShortcuts.js";
import QuestionPreview from "@/pages/QuizCreator/components/QuestionPreview";
import QuestionEditor from "@/pages/QuizCreator/components/QuestionEditor";
import AddQuestion from "@/pages/QuizCreator/components/AddQuestion";
import QuestionSettings from "@/pages/QuizCreator/components/QuestionSettings";
import AITopicPopover from "@/pages/QuizCreator/components/AITopicPopover";
import AIAdvancedDialog from "@/pages/QuizCreator/components/AIAdvancedDialog";
import toast from "react-hot-toast";
import {putRequest, jsonRequest} from "@/common/utils/RequestUtil.js";
import {useInputValidation, validationRules} from "@/common/hooks/useInputValidation";
import {prepareQuizData, prepareQuizDataForExport, cleanupQuestionImages, cleanupSingleQuestionImages} from "@/common/utils/QuizDataUtil.js";
import {createFileInput, importQuizzleFile, downloadQuizzleFile} from "@/common/utils/FileOperationsUtil.js";
import {QuizValidationUtil} from "@/common/utils/QuizValidationUtil.js";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import {DEFAULT_QUESTION_TYPE} from "@/common/constants/QuestionTypes.js";
import {useAIGeneration} from "@/common/hooks/useAIGeneration.jsx";
import {AuthContext} from "@/common/contexts/Auth";
import {DEFAULT_QUIZ_SETTINGS} from "@/common/constants/QuizSettings.js";
import QuizSettingsPanel from "@/pages/QuizCreator/components/QuizSettingsPanel";
import Dialog from "@/common/components/Dialog";
import SelectBox from "@/common/components/SelectBox";

const PRACTICE_EXPIRY_PRESETS = [
    {value: 'never', label: 'Kein Ablaufdatum'},
    {value: '1', label: '1 Tag'},
    {value: '7', label: '7 Tage'},
    {value: '14', label: '14 Tage (Standard)'},
    {value: '30', label: '30 Tage'},
    {value: 'custom', label: 'Benutzerdefiniert'}
];

export const QuizCreator = () => {
    const {setCirclePosition} = useOutletContext();
    const {logoImg} = useContext(BrandingContext);
    const {isAuthenticated, requireAuth} = useContext(AuthContext);

    const [errorToastId, setErrorToastId] = useState(null);
    const [aiAvailable, setAIAvailable] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showAIAdvanced, setShowAIAdvanced] = useState(false);
    const [showPracticeDialog, setShowPracticeDialog] = useState(false);
    const [practicePreset, setPracticePreset] = useState('14');
    const [practiceCustom, setPracticeCustom] = useState('');

    const initialQuizState = () => {
        const editRequest = localStorage.getItem("qq_edit_quiz");
        if (editRequest) {
            try {
                const parsed = JSON.parse(editRequest);
                const questions = (parsed.questions || []).map(q => ({
                    ...q,
                    uuid: q.uuid || generateUuid()
                }));

                if (questions.length > 0) {
                    return {
                        questions,
                        activeQuestion: questions[0].uuid,
                        title: parsed.title || "",
                        settings: {...DEFAULT_QUIZ_SETTINGS, ...(parsed.settings || {})}
                    };
                }
            } catch (e) {
                console.error("Error loading stored edit request:", e);
            }
        }

        const stored = localStorage.getItem("qq_questions");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const questions = parsed.map(q => {
                    const { b64_image, ...cleanQuestion } = q;
                    const questionType = cleanQuestion.type || DEFAULT_QUESTION_TYPE;

                    if (cleanQuestion.answers) {
                        cleanQuestion.answers = cleanQuestion.answers.map(answer => {
                            const { b64_image: answerB64, ...cleanAnswer } = answer;
                            if (questionType === QUESTION_TYPES.SLIDER) {
                                return cleanAnswer;
                            }
                            return {
                                ...cleanAnswer,
                                type: cleanAnswer.type || QUESTION_TYPES.TEXT
                            };
                        });
                    }
                    
                    return {
                        ...cleanQuestion,
                        type: questionType
                    };
                });
                let settings = DEFAULT_QUIZ_SETTINGS;
                const storedSettings = localStorage.getItem("qq_settings");
                if (storedSettings) {
                    try { settings = {...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(storedSettings)}; } catch (e) {}
                }
                return {
                    questions,
                    activeQuestion: questions[0].uuid,
                    title: localStorage.getItem("qq_title") || "",
                    settings
                };
            } catch (e) {
                console.error("Error parsing stored questions:", e);
            }
        }
        const uuid = generateUuid();
        let settings = DEFAULT_QUIZ_SETTINGS;
        const storedSettings = localStorage.getItem("qq_settings");
        if (storedSettings) {
            try { settings = {...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(storedSettings)}; } catch (e) {}
        }
        return {
            questions: [{uuid, title: "", type: DEFAULT_QUESTION_TYPE, answers: []}],
            activeQuestion: uuid,
            title: localStorage.getItem("qq_title") || "",
            settings
        };
    };

    const {current: quiz, set: setQuiz, silentSet: silentSetQuiz, undo, redo, canUndo, canRedo, clearHistory} = useUndoRedo(initialQuizState);
    const {questions, activeQuestion, title: quizTitle, settings: quizSettings} = quiz;
    const debounceRef = useRef(null);

    const titleValidation = useInputValidation(quizTitle, validationRules.quizTitle);

    useEffect(() => {
        if (titleValidation.value !== quizTitle) {
            titleValidation.setValue(quizTitle);
        }
    }, [quizTitle]);

    const setQuestions = useCallback((newQuestions) => {
        setQuiz(prev => ({...prev, questions: typeof newQuestions === "function" ? newQuestions(prev.questions) : newQuestions}));
    }, [setQuiz]);

    const silentSetQuestions = useCallback((newQuestions) => {
        silentSetQuiz(prev => ({...prev, questions: typeof newQuestions === "function" ? newQuestions(prev.questions) : newQuestions}));
    }, [silentSetQuiz]);

    const setActiveQuestion = useCallback((uuid) => {
        silentSetQuiz(prev => ({...prev, activeQuestion: uuid}));
    }, [silentSetQuiz]);

    const setSettings = useCallback((newSettings) => {
        setQuiz(prev => ({...prev, settings: typeof newSettings === "function" ? newSettings(prev.settings) : newSettings}));
    }, [setQuiz]);

    const setQuizDebounced = useCallback((updater) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        silentSetQuiz(updater);
        debounceRef.current = setTimeout(() => {
            setQuiz(prev => ({...prev}));
        }, 800);
    }, [silentSetQuiz, setQuiz]);

    const handleTitleChange = useCallback((newTitle) => {
        titleValidation.setValue(newTitle);
        setQuizDebounced(prev => ({...prev, title: newTitle}));
    }, [titleValidation, setQuizDebounced]);

    const {generating: aiGenerating, generate: aiGenerate, stop: aiStop} = useAIGeneration({
        setQuestions,
        setActiveQuestion,
        setTitle: (newTitle) => {
            titleValidation.setValue(newTitle);
            setQuiz(prev => ({...prev, title: newTitle}));
        },
        setDescription: (desc) => {
            setSettings(prev => ({...prev, description: desc}));
        }
    });

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

        const newActive = questionIndex === 0 ? newQuestions[0].uuid : newQuestions[questionIndex - 1].uuid;
        setQuiz(prev => ({...prev, questions: newQuestions, activeQuestion: newActive}));
    }

    const importQuiz = () => {
        createFileInput(".quizzle", async (file) => {
            try {
                const importedData = await importQuizzleFile(file);
                setQuiz(prev => ({
                    ...prev,
                    title: importedData.title,
                    questions: importedData.questions,
                    activeQuestion: importedData.questions[0].uuid,
                    settings: importedData.settings ? {...DEFAULT_QUIZ_SETTINGS, ...importedData.settings} : DEFAULT_QUIZ_SETTINGS
                }));
                titleValidation.setValue(importedData.title);
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
        setQuiz(prev => ({...prev, questions: newQuestions, activeQuestion: newUuid}));
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
        requireAuth(uploadQuiz);
    };

    const handlePracticeUploadClick = () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }
        if (!validateQuestions()) return;
        requireAuth(() => setShowPracticeDialog(true));
    };

    const resolvePracticeExpiry = () => {
        if (practicePreset === 'never') return null;
        if (practicePreset === 'custom') {
            const parsed = new Date(practiceCustom);
            if (!practiceCustom || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return undefined;
            return parsed.toISOString();
        }
        return new Date(Date.now() + Number(practicePreset) * 24 * 60 * 60 * 1000).toISOString();
    };

    const publishPracticeQuiz = async () => {
        const expiry = resolvePracticeExpiry();
        if (expiry === undefined) {
            toast.error("Bitte ein gültiges Ablaufdatum in der Zukunft wählen.");
            return;
        }

        const quizData = await prepareQuizData(questions, titleValidation.value, true);
        quizData.settings = quizSettings;
        quizData.expiry = expiry;

        try {
            const response = await putRequest("/practice", quizData);
            if (response.practiceCode) {
                setShowPracticeDialog(false);
                toast.success("Test erfolgreich erstellt!");
                toast.success(`Practice-Code: ${response.practiceCode}`, {duration: 10000});
                navigator.clipboard?.writeText(response.practiceCode);
            }
        } catch (error) {
            console.error('Practice quiz creation error:', error);
            toast.error(error.message || "Fehler beim Erstellen des Tests.");
        }
    };

    const uploadQuiz = async () => {
        if (!titleValidation.validate()) {
            toast.error("Quiz-Titel darf nicht leer sein.");
            return;
        }
        if (!validateQuestions()) return;

        const quizData = await prepareQuizData(questions, titleValidation.value, true);
        quizData.settings = quizSettings;

        putRequest("/quizzes", quizData).then((r) => {
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
        quizData.settings = quizSettings;
        downloadQuizzleFile(quizData, titleValidation.value.trim());
    }

    const addQuestion = () => {
        const uuid = generateUuid();
        setQuiz(prev => ({
            ...prev,
            questions: [...prev.questions, {uuid, title: "", type: DEFAULT_QUESTION_TYPE, answers: []}],
            activeQuestion: uuid
        }));
    }

    const onChangeWithSnapshot = (newQuestion) => {
        setQuiz(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.uuid === prev.activeQuestion ? newQuestion : q)
        }));
    };

    const onChange = (newQuestion) => {
        setQuizDebounced(prev => ({
            ...prev,
            questions: prev.questions.map(q => q.uuid === prev.activeQuestion ? newQuestion : q)
        }));
    };

    const clearQuiz = async () => {
        await cleanupQuestionImages(questions);
        const newUuid = generateUuid();
        titleValidation.reset();
        setQuiz(prev => ({
            questions: [{uuid: newUuid, title: "", type: DEFAULT_QUESTION_TYPE, answers: []}],
            activeQuestion: newUuid,
            title: "",
            settings: DEFAULT_QUIZ_SETTINGS
        }));
        clearHistory();
        localStorage.removeItem("qq_title");
        localStorage.removeItem("qq_questions");
        localStorage.removeItem("qq_settings");
    }

    const navigateQuestion = useCallback((direction) => {
        const currentIndex = questions.findIndex(q => q.uuid === activeQuestion);
        const nextIndex = currentIndex + direction;
        if (nextIndex >= 0 && nextIndex < questions.length) {
            setActiveQuestion(questions[nextIndex].uuid);
        }
    }, [questions, activeQuestion]);

    const shortcuts = useMemo(() => [
        {key: "z", ctrl: true, allowInInput: true, handler: undo},
        {key: "z", ctrl: true, shift: true, allowInInput: true, handler: redo},
        {key: "y", ctrl: true, allowInInput: true, handler: redo},
        {key: "ArrowUp", alt: true, allowInInput: true, handler: () => navigateQuestion(-1)},
        {key: "ArrowDown", alt: true, allowInInput: true, handler: () => navigateQuestion(1)},
        {key: "Enter", shift: true, handler: addQuestion},
    ], [undo, redo, navigateQuestion, addQuestion]);

    useKeyboardShortcuts(shortcuts);

    useEffect(() => {
        setCirclePosition(["-25rem -25rem auto auto", "-15rem -7rem auto auto"]);
        localStorage.removeItem("qq_edit_quiz");
    }, []);

    useEffect(() => {
        jsonRequest("/ai/status").then(data => {
            setAIAvailable(data?.available === true);
        }).catch(() => setAIAvailable(false));
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("qq_title", quizTitle);
            localStorage.setItem("qq_questions", JSON.stringify(questions));
            localStorage.setItem("qq_settings", JSON.stringify(quizSettings));

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

    }, [quizTitle, questions, quizSettings]);

    return (
        <div className="quiz-creator">
            <div className="quiz-header-area">
                <motion.div initial={{opacity: 0, x: -50}} animate={{opacity: 1, x: 0}} className="quiz-title-area">
                    <Link to="/">
                        <motion.img src={logoImg} alt="logo" initial={{opacity: 0, y: -50}} animate={{opacity: 1, y: 0}}/>
                    </Link>

                    <Input
                        className="quiz-title-input"
                        placeholder="Quiz-Titel eingeben"
                        value={titleValidation.value}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onBlur={titleValidation.onBlur}
                        error={titleValidation.error}
                        warning={titleValidation.warning}
                        maxLength={validationRules.quizTitle.maxLength}
                    />
                    <div className="quiz-action-area">
                        <div className="action-group">
                            <div
                                className={`action-button undo ${!canUndo ? 'disabled' : ''}`}
                                onClick={canUndo ? undo : undefined}
                                title="Rückgängig (Strg+Z)"
                            >
                                <FontAwesomeIcon icon={faRotateLeft} />
                            </div>
                            <div
                                className={`action-button redo ${!canRedo ? 'disabled' : ''}`}
                                onClick={canRedo ? redo : undefined}
                                title="Wiederholen (Strg+Shift+Z)"
                            >
                                <FontAwesomeIcon icon={faRotateRight} />
                            </div>
                        </div>

                        {aiAvailable && (
                            <AITopicPopover
                                generating={aiGenerating}
                                onGenerate={aiGenerate}
                                onStop={aiStop}
                                onOpenAdvanced={() => setShowAIAdvanced(true)}
                            />
                        )}

                        <div
                            className={`action-button settings ${showSettings ? 'active' : ''}`}
                            onClick={() => setShowSettings(s => !s)}
                            title="Quiz-Einstellungen"
                        >
                            <FontAwesomeIcon icon={faGear} />
                        </div>

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
                                className={`action-button upload ${!isAuthenticated ? 'locked' : ''}`}
                                onClick={handleUploadClick}
                                title={!isAuthenticated ? "Anmeldung erforderlich" : "Als Live-Quiz hochladen"}
                            >
                                <FontAwesomeIcon icon={faCloudUpload} />
                            </div>
                            <div 
                                className={`action-button practice ${!isAuthenticated ? 'locked' : ''}`}
                                onClick={handlePracticeUploadClick}
                                title={!isAuthenticated ? "Anmeldung erforderlich" : "Als Übungsquiz veröffentlichen"}
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
                        onReorder={silentSetQuestions}>
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
                    onChange={onChange} onCommit={onChangeWithSnapshot} deleteQuestion={deleteQuestion} duplicateQuestion={duplicateQuestion} />
                    
                {showSettings ? (
                    <QuizSettingsPanel settings={quizSettings} onChange={setSettings} />
                ) : (
                    <QuestionSettings key={`settings-${activeQuestion}`} question={questions.find(q => q.uuid === activeQuestion)} onChange={onChange} onCommit={onChangeWithSnapshot} defaultTimer={quizSettings.defaultTimer} />
                )}
            </div>

            <Dialog
                isOpen={showPracticeDialog}
                onClose={() => setShowPracticeDialog(false)}
                onConfirm={publishPracticeQuiz}
                title="Test veröffentlichen"
                confirmText="Test erstellen"
                cancelText="Abbrechen"
            >
                <div className="practice-dialog-form">
                    <div className="form-group">
                        <label>Gültigkeit des Tests</label>
                        <SelectBox value={practicePreset} onChange={setPracticePreset} options={PRACTICE_EXPIRY_PRESETS}/>
                    </div>
                    {practicePreset === 'custom' && (
                        <div className="form-group">
                            <label>Ablaufdatum und Uhrzeit</label>
                            <Input type="datetime-local" value={practiceCustom}
                                   onChange={(e) => setPracticeCustom(e.target.value)}/>
                        </div>
                    )}
                    {practicePreset === 'never' && (
                        <p className="practice-hint">Der Test läuft ohne Ablaufdatum und kann unbegrenzt gestartet werden.</p>
                    )}
                    <p className="practice-hint">
                        Abgelaufene Tests werden nicht gelöscht. Teilnehmer können sie nicht mehr starten, du kannst
                        Ergebnisse aber weiterhin einsehen und den Test in der Verwaltung löschen.
                    </p>
                </div>
            </Dialog>

            <AIAdvancedDialog
                isOpen={showAIAdvanced}
                onClose={() => setShowAIAdvanced(false)}
                onGenerate={aiGenerate}
                hasExistingMetadata={Boolean((titleValidation.value || '').trim()) || Boolean((quizSettings.description || '').trim())}
            />
        </div>
    )
}