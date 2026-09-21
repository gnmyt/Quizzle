import {useCallback, useContext, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import toast from "react-hot-toast";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faSwatchbook, faGraduationCap, faPlay, faChartBar, faPen, faTrash,
    faCircleCheck, faHourglassHalf, faInfinity, faRightFromBracket, faRotate
} from "@fortawesome/free-solid-svg-icons";
import {AuthContext} from "@/common/contexts/Auth";
import {BrandingContext} from "@/common/contexts/Branding";
import {QuizContext} from "@/common/contexts/Quiz";
import {jsonRequest, putRequest, deleteRequest} from "@/common/utils/RequestUtil.js";
import Button from "@/common/components/Button";
import Dialog from "@/common/components/Dialog";
import Input from "@/common/components/Input";
import SelectBox from "@/common/components/SelectBox";
import "./styles.sass";

const EXPIRY_PRESETS = [
    {value: 'never', label: 'Kein Ablaufdatum'},
    {value: '1', label: '1 Tag'},
    {value: '7', label: '7 Tage'},
    {value: '14', label: '14 Tage'},
    {value: '30', label: '30 Tage'},
    {value: 'custom', label: 'Benutzerdefiniert'}
];

const toDateTimeLocalValue = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const EDIT_STORAGE_KEY = 'qq_edit_quiz';

export const Manage = () => {
    const {user, isAdmin, isAuthenticated, authLoading, logout} = useContext(AuthContext);
    const {titleImg} = useContext(BrandingContext);
    const {loadQuizById} = useContext(QuizContext);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('quizzes');
    const [quizzes, setQuizzes] = useState([]);
    const [practiceQuizzes, setPracticeQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState(null);

    const [expiryTarget, setExpiryTarget] = useState(null);
    const [expiryPreset, setExpiryPreset] = useState('14');
    const [expiryCustom, setExpiryCustom] = useState('');

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [quizData, practiceData] = await Promise.all([
                jsonRequest('/admin/quizzes'),
                jsonRequest('/admin/practice')
            ]);
            setQuizzes(quizData.quizzes || []);
            setPracticeQuizzes(practiceData.practiceQuizzes || []);
        } catch (error) {
            toast.error(error.message || 'Verwaltung konnte nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) navigate('/');
    }, [authLoading, isAuthenticated, navigate]);

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;
        loadAll();
    }, [authLoading, isAuthenticated, loadAll]);

    const formatDate = (value) => {
        if (!value) return '–';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '–';
        return date.toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const startQuiz = async (quizId) => {
        if (!await loadQuizById(quizId)) {
            toast.error('Quiz konnte nicht geladen werden.');
            return;
        }
        toast.success('Quiz erfolgreich geladen!');
        navigate('/host/lobby');
    };

    const openResults = (code) => navigate(`/results/${code}`);

    const startPractice = (code) => navigate(`/?code=${code}`);

    const requestDelete = (type, entry) => setDeleteTarget({type, entry});

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const {type, entry} = deleteTarget;

        setBusy(true);
        try {
            if (type === 'quiz') {
                await deleteRequest(`/admin/quizzes/${entry.quizId}`);
                toast.success(`Quiz "${entry.title}" gelöscht.`);
            } else {
                await deleteRequest(`/admin/practice/${entry.code}`);
                toast.success(`Test "${entry.title}" gelöscht.`);
            }
            setDeleteTarget(null);
            await loadAll();
        } catch (error) {
            toast.error(error.message || 'Löschen fehlgeschlagen.');
        } finally {
            setBusy(false);
        }
    };

    const openExpiryDialog = (entry) => {
        setExpiryTarget(entry);
        if (entry.effectiveExpiry) {
            setExpiryPreset('custom');
            setExpiryCustom(toDateTimeLocalValue(new Date(entry.effectiveExpiry)));
        } else {
            setExpiryPreset('never');
            setExpiryCustom('');
        }
    };

    const saveExpiry = async () => {
        if (!expiryTarget) return;

        let expiry = null;
        if (expiryPreset === 'custom') {
            if (!expiryCustom) {
                toast.error('Bitte ein Ablaufdatum wählen.');
                return;
            }
            const parsed = new Date(expiryCustom);
            if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
                toast.error('Das Ablaufdatum muss in der Zukunft liegen.');
                return;
            }
            expiry = parsed.toISOString();
        } else if (expiryPreset !== 'never') {
            expiry = new Date(Date.now() + Number(expiryPreset) * 24 * 60 * 60 * 1000).toISOString();
        }

        setBusy(true);
        try {
            await putRequest(`/admin/practice/${expiryTarget.code}/expiry`, {expiry});
            toast.success('Ablaufdatum gespeichert.');
            setExpiryTarget(null);
            await loadAll();
        } catch (error) {
            toast.error(error.message || 'Ablaufdatum konnte nicht gespeichert werden.');
        } finally {
            setBusy(false);
        }
    };

    const editQuiz = async (entry) => {
        setBusy(true);
        try {
            const data = await jsonRequest(`/admin/quizzes/${entry.quizId}`);

            localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify({
                title: data.title,
                questions: (data.questions || []).map(question => ({...question, uuid: question.uuid || crypto.randomUUID()})),
                settings: data.settings || {}
            }));

            navigate('/create');
        } catch (error) {
            toast.error(error.message || 'Quiz konnte nicht geladen werden.');
        } finally {
            setBusy(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const expiredCount = useMemo(() => practiceQuizzes.filter(item => item.expired).length, [practiceQuizzes]);

    if (authLoading || loading) return null;

    if (!isAuthenticated) return null;

    const quizTabLabel = isAdmin ? 'Alle Quizze' : 'Meine Quizze';
    const practiceTabLabel = isAdmin ? 'Alle Tests' : 'Meine Tests';

    return (
        <div className="manage-page">
            <motion.div className="manage-header" initial={{opacity: 0, y: -20}} animate={{opacity: 1, y: 0}}>
                <button className="manage-logo-button" onClick={() => navigate('/')}>
                    <img src={titleImg} alt="logo" className="manage-logo"/>
                </button>
                <div className="manage-header-right">
                    <span className="manage-user-info">{user?.username}</span>
                    <Button text="Abmelden" icon={faRightFromBracket} type="secondary compact" onClick={handleLogout}/>
                </div>
            </motion.div>

            <motion.div className="manage-content" initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}}>
                <div className="manage-title-row">
                    <h1>Verwaltung</h1>
                    <Button text="Aktualisieren" icon={faRotate} type="secondary compact" onClick={loadAll}/>
                </div>

                <div className="manage-tabs">
                    <button
                        className={`manage-tab ${activeTab === 'quizzes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('quizzes')}
                    >
                        <FontAwesomeIcon icon={faSwatchbook}/>
                        {quizTabLabel}
                        <span className="tab-count">{quizzes.length}</span>
                    </button>
                    <button
                        className={`manage-tab ${activeTab === 'practice' ? 'active' : ''}`}
                        onClick={() => setActiveTab('practice')}
                    >
                        <FontAwesomeIcon icon={faGraduationCap}/>
                        {practiceTabLabel}
                        <span className="tab-count">{practiceQuizzes.length}</span>
                        {expiredCount > 0 && <span className="tab-badge">{expiredCount} abgelaufen</span>}
                    </button>
                </div>

                {activeTab === 'quizzes' && (
                    <div className="manage-panel">
                        {quizzes.length === 0 ? (
                            <div className="empty-state">
                                <FontAwesomeIcon icon={faSwatchbook}/>
                                <p>{isAdmin ? 'Noch keine Quizze gespeichert.' : 'Du hast noch keine Quizze gespeichert.'}</p>
                            </div>
                        ) : (
                            <div className={`manage-table ${isAdmin ? 'with-owner' : ''}`}>
                                <div className={`table-head quiz-grid ${isAdmin ? 'with-owner' : ''}`}>
                                    <span>Titel</span>
                                    <span>Quiz-ID</span>
                                    <span>Fragen</span>
                                    <span>Erstellt</span>
                                    {isAdmin && <span>Besitzer</span>}
                                    <span>Aktionen</span>
                                </div>
                                {quizzes.map(quiz => (
                                    <div key={quiz.quizId} className={`table-row quiz-grid ${isAdmin ? 'with-owner' : ''}`}>
                                        <span className="cell-title">{quiz.title}</span>
                                        <span className="cell-code">{quiz.quizId}</span>
                                        <span>{quiz.questionCount}</span>
                                        <span className="cell-muted">{formatDate(quiz.created)}</span>
                                        {isAdmin && (
                                            <span className="cell-owner">
                                                {quiz.ownerName || <span className="cell-muted">–</span>}
                                            </span>
                                        )}
                                        <span className="cell-actions">
                                            <button className="icon-btn" title="Quiz starten"
                                                    onClick={() => startQuiz(quiz.quizId)}>
                                                <FontAwesomeIcon icon={faPlay}/>
                                            </button>
                                            <button className="icon-btn" title="Quiz bearbeiten"
                                                    onClick={() => editQuiz(quiz)}>
                                                <FontAwesomeIcon icon={faPen}/>
                                            </button>
                                            <button className="icon-btn danger" title="Quiz löschen"
                                                    onClick={() => requestDelete('quiz', quiz)}>
                                                <FontAwesomeIcon icon={faTrash}/>
                                            </button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'practice' && (
                    <div className="manage-panel">
                        {practiceQuizzes.length === 0 ? (
                            <div className="empty-state">
                                <FontAwesomeIcon icon={faGraduationCap}/>
                                <p>{isAdmin ? 'Noch keine Tests erstellt.' : 'Du hast noch keine Tests erstellt.'}</p>
                            </div>
                        ) : (
                            <div className={`manage-table ${isAdmin ? 'with-owner' : ''}`}>
                                <div className={`table-head practice-grid ${isAdmin ? 'with-owner' : ''}`}>
                                    <span>Titel</span>
                                    <span>Code</span>
                                    <span>Ablauf</span>
                                    <span>Status</span>
                                    <span>Ergebnisse</span>
                                    {isAdmin && <span>Besitzer</span>}
                                    <span>Aktionen</span>
                                </div>
                                {practiceQuizzes.map(entry => (
                                    <div key={entry.code}
                                         className={`table-row practice-grid ${isAdmin ? 'with-owner' : ''} ${entry.expired ? 'expired' : ''}`}>
                                        <span className="cell-title">
                                            {entry.title}
                                            <span className="cell-sub">{entry.questionCount} Fragen · erstellt {formatDate(entry.created)}</span>
                                        </span>
                                        <span className="cell-code">{entry.code}</span>
                                        <span className="cell-muted">
                                            {entry.effectiveExpiry ? (
                                                <>
                                                    {formatDate(entry.effectiveExpiry)}
                                                    {!entry.expiry && <span className="cell-sub">Standardgültigkeit</span>}
                                                </>
                                            ) : (
                                                <span className="never-expires">
                                                    <FontAwesomeIcon icon={faInfinity}/> kein Ablauf
                                                </span>
                                            )}
                                        </span>
                                        <span>
                                            {entry.expired ? (
                                                <span className="status-pill expired">
                                                    <FontAwesomeIcon icon={faHourglassHalf}/> Abgelaufen
                                                </span>
                                            ) : (
                                                <span className="status-pill active">
                                                    <FontAwesomeIcon icon={faCircleCheck}/> Aktiv
                                                </span>
                                            )}
                                        </span>
                                        <span className="cell-results">{entry.resultCount}</span>
                                        {isAdmin && (
                                            <span className="cell-owner">
                                                {entry.ownerName || <span className="cell-muted">–</span>}
                                            </span>
                                        )}
                                        <span className="cell-actions">
                                            <button className="icon-btn" title="Ergebnisse anzeigen"
                                                    onClick={() => openResults(entry.code)}>
                                                <FontAwesomeIcon icon={faChartBar}/>
                                            </button>
                                            <button className="icon-btn" title={entry.expired ? 'Test ist abgelaufen' : 'Test starten'}
                                                    disabled={entry.expired}
                                                    onClick={() => startPractice(entry.code)}>
                                                <FontAwesomeIcon icon={faPlay}/>
                                            </button>
                                            <button className="icon-btn" title="Ablaufdatum ändern"
                                                    onClick={() => openExpiryDialog(entry)}>
                                                <FontAwesomeIcon icon={faPen}/>
                                            </button>
                                            <button className="icon-btn danger" title="Test löschen"
                                                    onClick={() => requestDelete('practice', entry)}>
                                                <FontAwesomeIcon icon={faTrash}/>
                                            </button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </motion.div>

            <Dialog
                isOpen={Boolean(deleteTarget)}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title={deleteTarget?.type === 'quiz' ? 'Quiz löschen?' : 'Test löschen?'}
                confirmText={busy ? 'Lösche...' : 'Endgültig löschen'}
                cancelText="Abbrechen"
            >
                {deleteTarget?.type === 'quiz' ? (
                    <div className="delete-warning">
                        <p>Das Quiz <strong>{deleteTarget.entry.title}</strong> ({deleteTarget.entry.quizId}) wird
                            dauerhaft entfernt.</p>
                        <p>Bereits heruntergeladene Dateien sind davon nicht betroffen. Diese Aktion kann nicht
                            rückgängig gemacht werden.</p>
                    </div>
                ) : deleteTarget && (
                    <div className="delete-warning">
                        <p>Beim Löschen des Tests <strong>{deleteTarget.entry.title}</strong> ({deleteTarget.entry.code})
                            werden dauerhaft gelöscht:</p>
                        <ul>
                            <li>der Test und alle Testdaten</li>
                            <li>alle gespeicherten Ergebnisse ({deleteTarget.entry.resultCount})</li>
                        </ul>
                        <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
                    </div>
                )}
            </Dialog>

            <Dialog
                isOpen={Boolean(expiryTarget)}
                onClose={() => setExpiryTarget(null)}
                onConfirm={saveExpiry}
                title={`Ablaufdatum für ${expiryTarget?.title || ''}`}
                confirmText={busy ? 'Speichere...' : 'Speichern'}
                cancelText="Abbrechen"
            >
                <div className="expiry-form">
                    <div className="form-group">
                        <label>Gültigkeit</label>
                        <SelectBox value={expiryPreset} onChange={setExpiryPreset} options={EXPIRY_PRESETS}/>
                    </div>
                    {expiryPreset === 'custom' && (
                        <div className="form-group">
                            <label>Ablaufdatum und Uhrzeit</label>
                            <Input type="datetime-local" value={expiryCustom}
                                   onChange={(e) => setExpiryCustom(e.target.value)}/>
                        </div>
                    )}
                    {expiryPreset === 'never' && (
                        <p className="form-hint">Der Test läuft ohne Ablaufdatum und kann unbegrenzt gestartet
                            werden. Ergebnisse bleiben erhalten.</p>
                    )}
                </div>
            </Dialog>
        </div>
    );
};

export default Manage;