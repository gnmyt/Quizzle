import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUsers, 
    faQuestionCircle, 
    faChartLine, 
    faExclamationTriangle,
    faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import StatCard from '../StatCard';
import './styles.sass';

const ClassOverview = ({ analyticsData, isLiveQuiz }) => {
    const { classAnalytics, questionAnalytics } = analyticsData;

    const difficultyDistribution = questionAnalytics.reduce((acc, q) => {
        acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="class-overview">
            <div className="stats-grid">
                <StatCard
                    icon={faUsers}
                    title="Teilnehmer"
                    value={classAnalytics.totalStudents}
                    color="blue"
                />
                <StatCard
                    icon={faQuestionCircle}
                    title="Fragen"
                    value={classAnalytics.totalQuestions}
                    color="green"
                />
                <StatCard
                    icon={faChartLine}
                    title="Ø Genauigkeit"
                    value={`${classAnalytics.averageAccuracy}%`}
                    color={classAnalytics.averageAccuracy >= 80 ? 'green' : 
                           classAnalytics.averageAccuracy >= 60 ? 'orange' : 'red'}
                />
                <StatCard
                    icon={faExclamationTriangle}
                    title="Schwere Fragen"
                    value={classAnalytics.questionsNeedingReview}
                    color={classAnalytics.questionsNeedingReview > 0 ? 'red' : 'green'}
                />
            </div>

            <div className="difficulty-section">
                <h3>Schwierigkeitsverteilung</h3>
                <div className="difficulty-overview">
                    <div className="difficulty-stats">
                        <div className="difficulty-item easy">
                            <div className="difficulty-icon">
                                <FontAwesomeIcon icon={faCheckCircle} />
                            </div>
                            <div className="difficulty-info">
                                <span className="difficulty-label">Einfach</span>
                                <span className="difficulty-count">{difficultyDistribution.easy || 0} Fragen</span>
                            </div>
                        </div>
                        
                        <div className="difficulty-item medium">
                            <div className="difficulty-icon">
                                <FontAwesomeIcon icon={faQuestionCircle} />
                            </div>
                            <div className="difficulty-info">
                                <span className="difficulty-label">Mittel</span>
                                <span className="difficulty-count">{difficultyDistribution.medium || 0} Fragen</span>
                            </div>
                        </div>
                        
                        <div className="difficulty-item hard">
                            <div className="difficulty-icon">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                            </div>
                            <div className="difficulty-info">
                                <span className="difficulty-label">Schwer</span>
                                <span className="difficulty-count">{difficultyDistribution.hard || 0} Fragen</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="difficulty-summary">
                        <div className="summary-text">
                            {classAnalytics.questionsNeedingReview > 0 ? (
                                <span className="needs-review">
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                    {classAnalytics.questionsNeedingReview} Fragen benötigen Wiederholung
                                </span>
                            ) : (
                                <span className="all-good">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                    Alle Fragen wurden gut verstanden
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isLiveQuiz && (
                <div className="live-quiz-info">
                    <strong>Ø Punkte: {classAnalytics.averageScore}</strong>
                </div>
            )}
        </div>
    );
};

export default ClassOverview;