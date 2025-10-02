import {useState, useEffect, useContext} from "react";
import {useParams, useNavigate, useLocation} from "react-router-dom";
import {BrandingContext} from "@/common/contexts/Branding";
import {motion} from "framer-motion";
import Button from "@/common/components/Button";
import Dialog from "@/common/components/Dialog";
import {postRequest} from "@/common/utils/RequestUtil.js";
import {getCharacterEmoji} from "@/common/data/characters";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faUser, faCheck, faTimes, faMinus, faChartBar, faDownload, faHome} from "@fortawesome/free-solid-svg-icons";
import AnalyticsTabs from "@/common/components/AnalyticsTabs";
import {exportPracticeResultsToExcel} from "@/common/utils/ExcelExport";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import "./styles.sass";
import toast from "react-hot-toast";

export const PracticeResults = () => {
    const {code} = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const {titleImg, passwordProtected} = useContext(BrandingContext);

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentDetailsOpen, setStudentDetailsOpen] = useState(false);
    const [activeView, setActiveView] = useState('analytics');

    useEffect(() => {
        loadResultsWithPassword(location.state?.password || "");
    }, [location.state]);

    const loadResultsWithPassword = async (pwd) => {
        setLoading(true);
        try {
            const requestBody = passwordProtected ? {password: pwd} : {};
            const response = await postRequest(`/practice/${code}/results`, requestBody);
            setResults(response);
        } catch (error) {
            console.error('Error loading results:', error);
            if (error.message && error.message.includes('401')) {
                toast.error('Ungültiges Passwort.');
                navigate('/');
            } else if (error.message && error.message.includes('404')) {
                toast.error('Übungsquiz nicht gefunden.');
                navigate('/');
            } else {
                toast.error('Fehler beim Laden der Ergebnisse.');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end - start;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const showStudentDetails = (studentName, attempts) => {
        setSelectedStudent({name: studentName, attempts});
        setStudentDetailsOpen(true);
    };

    const closeStudentDetails = () => {
        setSelectedStudent(null);
        setStudentDetailsOpen(false);
    };

    const handleExportToExcel = () => {
        if (!results || !analyticsData) {
            toast.error('Keine Daten zum Exportieren verfügbar');
            return;
        }

        try {
            const filename = exportPracticeResultsToExcel(results, code);
            toast.success(`Analytics exportiert: ${filename}`);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            toast.error('Fehler beim Exportieren der Daten');
        }
    };

    const generatePracticeAnalytics = () => {
        if (results && results.analytics) {
            return results.analytics;
        }

        if (!results || !results.results || !results.quiz) {
            return null;
        }

        const totalStudents = Object.keys(results.studentResults).length;
        const totalQuestions = results.quiz.questions.length;
        const allResults = results.results;

        const questionAnalytics = results.quiz.questions.map((question, questionIndex) => {
            let correctCount = 0;
            let partialCount = 0;
            let incorrectCount = 0;
            let totalResponses = 0;

            allResults.forEach(result => {
                if (result.answers && result.answers[questionIndex]) {
                    totalResponses++;
                    const answerResult = result.answers[questionIndex].result;
                    if (answerResult === 'correct') correctCount++;
                    else if (answerResult === 'partial') partialCount++;
                    else incorrectCount++;
                }
            });

            const correctPercentage = totalResponses > 0 ? Math.round((correctCount / totalResponses) * 100) : 0;

            return {
                questionIndex,
                title: question.title,
                type: question.type,
                totalResponses,
                correctCount,
                partialCount,
                incorrectCount,
                correctPercentage,
                difficulty: correctPercentage >= 80 ? 'easy' : correctPercentage >= 60 ? 'medium' : 'hard',
                needsReview: correctPercentage < 60
            };
        });

        const studentAnalytics = Object.entries(results.studentResults).map(([studentName, attempts]) => {
            const bestAttempt = attempts.reduce((best, current) =>
                current.score > best.score ? current : best
            );

            const totalAttempts = attempts.length;
            const avgScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts;
            const avgAccuracy = Math.round((avgScore / totalQuestions) * 100);

            let correctAnswers = 0;
            let partialAnswers = 0;
            let incorrectAnswers = 0;

            if (bestAttempt.answers) {
                bestAttempt.answers.forEach(answer => {
                    if (answer.result === 'correct') correctAnswers++;
                    else if (answer.result === 'partial') partialAnswers++;
                    else incorrectAnswers++;
                });
            }

            return {
                id: studentName,
                name: studentName,
                character: bestAttempt.character,
                totalPoints: bestAttempt.score,
                correctAnswers,
                partialAnswers,
                incorrectAnswers,
                totalAnswered: totalQuestions,
                accuracy: avgAccuracy,
                needsAttention: avgAccuracy < 60,
                attempts: totalAttempts,
                avgScore: Math.round(avgScore * 100) / 100
            };
        });

        const classAnalytics = {
            totalStudents,
            totalQuestions,
            averageScore: results.meta.averageScore,
            averageAccuracy: studentAnalytics.length > 0 ?
                Math.round((studentAnalytics.reduce((sum, student) => sum + student.accuracy, 0) / studentAnalytics.length) * 100) / 100 : 0,
            questionsNeedingReview: questionAnalytics.filter(q => q.needsReview).length,
            studentsNeedingAttention: studentAnalytics.filter(s => s.needsAttention).length,
            participationRate: 100,
            totalAttempts: results.meta.totalAttempts
        };

        return {
            classAnalytics,
            questionAnalytics,
            studentAnalytics
        };
    };

    const renderAnswerContent = (question, answer, result, correctAnswer) => {
        if (question.type === QUESTION_TYPES.TEXT) {
            return (
                <div className="text-answer">
                    <div className="answer-line">
                        <span className="answer-label">Antwort:</span>
                        <span className={`answer-value ${result === 'correct' ? 'correct' : 'incorrect'}`}>
                            {answer}
                        </span>
                        <FontAwesomeIcon
                            icon={result === 'correct' ? faCheck : faTimes}
                            className={`answer-icon ${result === 'correct' ? 'correct' : 'incorrect'}`}
                        />
                    </div>
                    {result !== 'correct' && (
                        <div className="answer-line">
                            <span className="answer-label">Richtig:</span>
                            <span className="answer-value correct">{correctAnswer}</span>
                        </div>
                    )}
                </div>
            );
        } else if (question.type === QUESTION_TYPES.SEQUENCE) {
            const userOrder = Array.isArray(answer) ? answer : [];
            const correctOrder = Array.isArray(correctAnswer) ? correctAnswer : [];
            
            return (
                <div className="sequence-answer">
                    <div className="answer-line">
                        <span className="answer-label">Ihre Reihenfolge:</span>
                        <div className="sequence-list">
                            {userOrder.map((originalIndex, position) => {
                                const answerContent = question.answers[originalIndex]?.content || `Antwort ${originalIndex + 1}`;
                                const isCorrectPosition = userOrder[position] === position;
                                return (
                                    <div 
                                        key={position} 
                                        className={`sequence-item ${isCorrectPosition ? 'correct' : 'incorrect'}`}
                                    >
                                        <span className="position-number">{position + 1}.</span>
                                        <span className="answer-content">{answerContent}</span>
                                        <FontAwesomeIcon
                                            icon={isCorrectPosition ? faCheck : faTimes}
                                            className={`answer-icon ${isCorrectPosition ? 'correct' : 'incorrect'}`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {result !== 'correct' && (
                        <div className="answer-line">
                            <span className="answer-label">Richtige Reihenfolge:</span>
                            <div className="sequence-list correct-order">
                                {correctOrder.map((content, position) => (
                                    <div key={position} className="sequence-item correct">
                                        <span className="position-number">{position + 1}.</span>
                                        <span className="answer-content">{content}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        } else {
            const userSelections = Array.isArray(answer) ? answer : [answer];
            const correctIndices = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];

            return (
                <div className="mc-answer">
                    {question.answers.map((option, index) => {
                        const isSelected = userSelections.includes(index);
                        const isCorrectOption = correctIndices.includes(index);
                        const showAsCorrect = isCorrectOption;
                        const showAsIncorrect = isSelected && !isCorrectOption;

                        return (
                            <div
                                key={index}
                                className={`answer-option ${
                                    showAsCorrect ? 'correct' :
                                        showAsIncorrect ? 'incorrect' :
                                            isSelected ? 'selected' : ''
                                }`}
                            >
                                <span className="option-content">{option.content}</span>
                                {(showAsCorrect || showAsIncorrect) && (
                                    <FontAwesomeIcon
                                        icon={showAsCorrect ? faCheck : faTimes}
                                        className={`answer-icon ${showAsCorrect ? 'correct' : 'incorrect'}`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }
    };

    if (loading) {
        return (
            <div className="practice-results-page">
                <div className="page-header">
                    <img src={titleImg} alt="logo" className="logo"/>
                    <h1>Ergebnisse werden geladen...</h1>
                </div>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="practice-results-page">
                <div className="page-header">
                    <img src={titleImg} alt="logo" className="logo"/>
                    <h1>Keine Ergebnisse gefunden</h1>
                    <div className="code-display">Code: <strong>{code}</strong></div>
                </div>
                <motion.div className="auth-card" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}}>
                    <Button text="Zurück zur Startseite" onClick={() => navigate('/')} />
                </motion.div>
            </div>
        );
    }

    const sortedResults = results.results.sort((a, b) => b.score - a.score);
    const topScore = sortedResults[0]?.score || 0;
    const analyticsData = generatePracticeAnalytics();

    const viewTabs = [
        {id: 'analytics', title: 'Analytics', icon: faChartBar},
        {id: 'students', title: 'Details', icon: faUser}
    ];

    return (
        <div className="practice-results-page">
            <div className="page-header">
                <img src={titleImg} alt="logo" className="logo"/>
                <h1>Übungsquiz Ergebnisse</h1>
                <div className="code-display">Code: <strong>{code}</strong></div>
            </div>

            <motion.div
                className="results-content"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
            >
                <div className="stats-overview">
                    <div className="stat-card">
                        <div className="stat-number">{results.meta.totalAttempts}</div>
                        <div className="stat-label">Versuche</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{results.meta.averageScore.toFixed(1)}</div>
                        <div className="stat-label">Durchschnitt</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{topScore}</div>
                        <div className="stat-label">Beste Punktzahl</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">
                            {formatDuration(results.meta.created, results.meta.expiry)} Tage
                        </div>
                        <div className="stat-label">Verbleiben</div>
                    </div>
                </div>

                <div className="tabs-content-section">
                    <div className="view-navigation">
                        {viewTabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`view-tab ${activeView === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveView(tab.id)}
                            >
                                <FontAwesomeIcon icon={tab.icon}/>
                                <span>{tab.title}</span>
                            </button>
                        ))}
                    </div>
                    <div className="tab-content-wrapper">
                        {activeView === 'analytics' && analyticsData && (
                            <div className="analytics-section">
                                <AnalyticsTabs
                                    analyticsData={analyticsData}
                                    quizData={results.quiz}
                                    isLiveQuiz={false}
                                />
                            </div>
                        )}

                        {activeView === 'students' && (
                            <div className="students-section">
                                <h3>Nach Schülern gruppiert</h3>
                                <div className="students-grid">
                                    {Object.entries(results.studentResults).map(([studentName, attempts]) => {
                                        const bestAttempt = attempts.reduce((best, current) =>
                                            current.score > best.score ? current : best
                                        );
                                        const totalAttempts = attempts.length;
                                        const avgScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts;

                                        return (
                                            <div
                                                key={studentName}
                                                className="student-card clickable"
                                                onClick={() => showStudentDetails(studentName, attempts)}
                                            >
                                                <div className="student-header">
                                                    <div className="student-name">
                                                        <span
                                                            className="player-character">{getCharacterEmoji(bestAttempt.character)}</span>
                                                        {studentName}
                                                    </div>
                                                </div>
                                                <div className="student-stats">
                                                    <div className="stat">
                                                        <span className="label">Versuche:</span>
                                                        <span className="value">{totalAttempts}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="label">Beste:</span>
                                                        <span
                                                            className="value">{bestAttempt.score}/{bestAttempt.total}</span>
                                                    </div>
                                                    <div className="stat">
                                                        <span className="label">Durchschnitt:</span>
                                                        <span className="value">{avgScore.toFixed(1)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bottom-actions-section">
                    <Button 
                        text="Zurück zur Startseite"
                        icon={faHome}
                        onClick={() => navigate('/')}
                        type="compact primary"
                    />
                    {analyticsData && (
                        <Button
                            text="Als Excel herunterladen"
                            icon={faDownload}
                            onClick={handleExportToExcel}
                            type="compact green"
                        />
                    )}
                </div>
            </motion.div>

            <Dialog
                isOpen={studentDetailsOpen}
                onClose={closeStudentDetails}
                onConfirm={closeStudentDetails}
                title={
                    selectedStudent && (
                        <div className="student-details-title">
                            <FontAwesomeIcon icon={faUser} className="student-details-title-icon"/>
                            Detailansicht: {selectedStudent.name}
                        </div>
                    )
                }
                showCancelButton={false}
                confirmText=""
                className="student-details-dialog"
            >
                {selectedStudent && (
                    <div className="student-details-content">
                        <div className="attempts-selector">
                            <h4>Versuch auswählen:</h4>
                            <div className="attempts-list">
                                {selectedStudent.attempts.map((attempt, index) => {
                                    const percentage = Math.round((attempt.score / attempt.total) * 100);
                                    return (
                                        <div key={index} className="attempt-item">
                                            <div className="attempt-header">
                                                <strong>Versuch {index + 1}</strong>
                                                <span className="attempt-score">
                                                    {attempt.score}/{attempt.total} ({percentage}%)
                                                </span>
                                                <span className="attempt-date">
                                                    {formatDate(attempt.timestamp)}
                                                </span>
                                            </div>

                                            <div className="attempt-questions">
                                                {attempt.answers && results.quiz && results.quiz.questions && attempt.answers.map((answerData, qIndex) => {
                                                    const question = results.quiz.questions[qIndex];
                                                    if (!question) return null;

                                                    return (
                                                        <div key={qIndex} className="question-detail">
                                                            <div className="question-header">
                                                                <span
                                                                    className="question-number">Frage {qIndex + 1}:</span>
                                                                <FontAwesomeIcon
                                                                    icon={
                                                                        answerData.result === 'correct' ? faCheck :
                                                                            answerData.result === 'partial' ? faMinus : faTimes
                                                                    }
                                                                    className={`question-result ${
                                                                        answerData.result === 'correct' ? 'correct' :
                                                                            answerData.result === 'partial' ? 'partial' : 'incorrect'
                                                                    }`}
                                                                />
                                                            </div>
                                                            <div className="question-text">{question.title}</div>
                                                            {renderAnswerContent(
                                                                question,
                                                                answerData.userAnswer,
                                                                answerData.result,
                                                                answerData.correctAnswer
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {(!results.quiz || !results.quiz.questions) && (
                                                    <div className="loading-questions">
                                                        Fragen werden geladen...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};
