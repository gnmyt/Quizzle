import React from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
    faQuestionCircle,
    faCheck,
    faTimes,
    faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import './styles.sass';

const QuestionAnalytics = ({analyticsData}) => {
    const {questionAnalytics} = analyticsData;

    const getDifficultyText = (difficulty) => {
        switch (difficulty) {
            case 'easy':
                return 'Einfach';
            case 'medium':
                return 'Mittel';
            case 'hard':
                return 'Schwer';
            default:
                return 'Unbekannt';
        }
    };

    const needsReview = questionAnalytics.filter(q => q.needsReview);

    return (
        <div className="question-analytics">
            <div className="questions-list">
                {questionAnalytics.map((question, index) => (
                    <div key={index} className={`question-card ${question.difficulty}`}>
                        <div className="question-header">
                            <div className="question-title">
                                <FontAwesomeIcon icon={faQuestionCircle}/>
                                <span className="question-number">Frage {index + 1}</span>
                                {question.needsReview && (
                                    <FontAwesomeIcon
                                        icon={faExclamationTriangle}
                                        className="review-icon"
                                    />
                                )}
                            </div>
                            <div className="question-stats">
                                <span className={`difficulty-badge ${question.difficulty}`}>
                                    {getDifficultyText(question.difficulty)}
                                </span>
                                <span className="accuracy-badge">
                                    {question.correctPercentage}%
                                </span>
                            </div>
                        </div>

                        <div className="question-content">
                            <h4>{question.title}</h4>
                            <div className="response-summary">
                                <div className="response-bar">
                                    <div
                                        className="response-segment correct"
                                        style={{
                                            width: `${(question.correctCount / question.totalResponses) * 100}%`
                                        }}
                                    />
                                    {question.partialCount > 0 && (
                                        <div
                                            className="response-segment partial"
                                            style={{
                                                width: `${(question.partialCount / question.totalResponses) * 100}%`
                                            }}
                                        />
                                    )}
                                    <div
                                        className="response-segment incorrect"
                                        style={{
                                            width: `${(question.incorrectCount / question.totalResponses) * 100}%`
                                        }}
                                    />
                                </div>
                                <div className="response-counts">
                                    <span className="correct-count">
                                        <FontAwesomeIcon icon={faCheck}/>
                                        {question.correctCount}
                                    </span>
                                    <span className="incorrect-count">
                                        <FontAwesomeIcon icon={faTimes}/>
                                        {question.incorrectCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {needsReview.length > 0 && (
                <div className="review-section">
                    <h3>
                        <FontAwesomeIcon icon={faExclamationTriangle}/>
                        Schwere Fragen ({needsReview.length})
                    </h3>
                    <div className="review-list">
                        {needsReview.map((question) => (
                            <div key={question.questionIndex} className="review-item">
                                <span className="question-info">
                                    Frage {question.questionIndex + 1}: {question.title}
                                </span>
                                <span className="question-stats">
                                    {question.correctPercentage}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionAnalytics;