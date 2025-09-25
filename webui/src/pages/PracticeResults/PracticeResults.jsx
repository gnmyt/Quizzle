import {useState, useEffect, useContext} from "react";
import {useParams, useNavigate, useLocation} from "react-router-dom";
import {BrandingContext} from "@/common/contexts/Branding";
import {motion} from "framer-motion";
import Button from "@/common/components/Button";
import Input from "@/common/components/Input";
import Dialog from "@/common/components/Dialog";
import {postRequest} from "@/common/utils/RequestUtil.js";
import {getCharacterEmoji} from "@/common/data/characters";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faUser, faCheck, faTimes, faMinus} from "@fortawesome/free-solid-svg-icons";
import "./styles.sass";
import toast from "react-hot-toast";

export const PracticeResults = () => {
    const {code} = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const {titleImg} = useContext(BrandingContext);

    const [password, setPassword] = useState("");
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentDetailsOpen, setStudentDetailsOpen] = useState(false);

    useEffect(() => {
        if (location.state?.password) {
            loadResultsWithPassword(location.state.password);
        }
    }, [location.state]);

    const loadResultsWithPassword = async (pwd) => {
        setLoading(true);
        try {
            const response = await postRequest(`/practice/${code}/results`, {password: pwd});
            setResults(response);
            setAuthenticated(true);
        } catch (error) {
            console.error('Error loading results:', error);
            if (error.message && error.message.includes('401')) {
                toast.error('Ungültiges Passwort.');
            } else if (error.message && error.message.includes('404')) {
                toast.error('Übungsquiz nicht gefunden.');
            } else {
                toast.error('Fehler beim Laden der Ergebnisse.');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadResults = async () => {
        if (!password.trim()) {
            toast.error('Bitte Passwort eingeben.');
            return;
        }

        await loadResultsWithPassword(password);
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

    const renderAnswerContent = (question, answer, result, correctAnswer) => {
        if (question.type === 'text') {
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

    if (!authenticated) {
        return (
            <div className="practice-results-page">
                <div className="page-header">
                    <img src={titleImg} alt="logo" className="logo"/>
                    <h1>Ergebnisse einsehen</h1>
                    <div className="code-display">Code: <strong>{code}</strong></div>
                </div>

                <motion.div
                    className="auth-card"
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                >
                    <h2>Passwort eingeben</h2>

                    <div className="auth-form">
                        <Input
                            type="password"
                            placeholder="Passwort eingeben"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && loadResults()}
                            disabled={loading}
                            autoFocus
                        />

                        <div className="auth-actions">
                            <Button
                                text="Zurück"
                                onClick={() => navigate('/')}
                                variant="secondary"
                                disabled={loading}
                            />
                            <Button
                                text={loading ? "Wird geladen..." : "Ergebnisse laden"}
                                onClick={loadResults}
                                disabled={loading || !password.trim()}
                            />
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="practice-results-page">
                <div className="page-header">
                    <img src={titleImg} alt="logo" className="logo"/>
                    <h1>Ergebnisse werden geladen...</h1>
                </div>
            </div>
        );
    }

    const sortedResults = results.results.sort((a, b) => b.score - a.score);
    const topScore = sortedResults[0]?.score || 0;

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
                        <div className="stat-label">Verbleibt</div>
                    </div>
                </div>

                <div className="results-section">
                    <h3>Alle Ergebnisse ({results.meta.totalAttempts})</h3>
                    <div className="results-table">
                        <div className="table-header">
                            <div className="col-rank">Rang</div>
                            <div className="col-name">Name</div>
                            <div className="col-score">Punktzahl</div>
                            <div className="col-percentage">Prozent</div>
                            <div className="col-timestamp">Zeitstempel</div>
                        </div>

                        {sortedResults.map((result, index) => {
                            const percentage = Math.round((result.score / result.total) * 100);
                            return (
                                <div key={index} className={`table-row ${index === 0 ? 'best-score' : ''}`}>
                                    <div className="col-rank">
                                        {index === 0 ? '🏆' : `#${index + 1}`}
                                    </div>
                                    <div className="col-name">
                                        <span className="player-character">{getCharacterEmoji(result.character)}</span>
                                        {result.name}
                                    </div>
                                    <div className="col-score">
                                        {result.score}/{result.total}
                                    </div>
                                    <div className="col-percentage">
                                        <div
                                            className={`percentage ${percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : 'needs-improvement'}`}>
                                            {percentage}%
                                        </div>
                                    </div>
                                    <div className="col-timestamp">
                                        {formatDate(result.timestamp)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="results-section">
                    <h3>Nach Studenten gruppiert</h3>
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
                                            <span className="value">{bestAttempt.score}/{bestAttempt.total}</span>
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

                <div className="page-actions">
                    <Button text="Zurück zur Startseite" onClick={() => navigate('/')}/>
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
