import React from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
    faExclamationTriangle,
    faCheckCircle,
    faUsers,
    faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import './styles.sass';

const RecommendationsTab = ({analyticsData}) => {
    const {classAnalytics, questionAnalytics, studentAnalytics} = analyticsData;

    const recommendations = [];

    const strugglingStudents = studentAnalytics.filter(s => s.needsAttention);
    const hardQuestions = questionAnalytics.filter(q => q.needsReview);

    if (strugglingStudents.length > 0) {
        recommendations.push({
            type: 'urgent',
            icon: faExclamationTriangle,
            title: `${strugglingStudents.length} Schüler benötigen Hilfe`,
            students: strugglingStudents.map(s => `${s.name} (${s.accuracy}%)`)
        });
    }

    if (hardQuestions.length > 0) {
        recommendations.push({
            type: 'warning',
            icon: faQuestionCircle,
            title: `${hardQuestions.length} schwere Fragen`,
            questions: hardQuestions.map(q => `Frage ${q.questionIndex + 1}: ${q.correctPercentage}%`)
        });
    }

    if (classAnalytics.averageAccuracy < 60) {
        recommendations.push({
            type: 'urgent',
            icon: faUsers,
            title: `Niedrige Klassenleistung: ${classAnalytics.averageAccuracy}%`,
            action: 'Wiederholung der Inhalte empfohlen'
        });
    } else if (classAnalytics.averageAccuracy >= 80) {
        recommendations.push({
            type: 'success',
            icon: faCheckCircle,
            title: `Gute Klassenleistung: ${classAnalytics.averageAccuracy}%`,
            action: 'Klasse ist bereit für neue Themen'
        });
    }

    return (
        <div className="recommendations-tab">
            {recommendations.length > 0 ? (
                <div className="recommendations-list">
                    {recommendations.map((rec, index) => (
                        <div key={index} className={`recommendation-card ${rec.type}`}>
                            <div className="recommendation-header">
                                <FontAwesomeIcon
                                    icon={rec.icon}
                                    className={`recommendation-icon ${rec.type}`}
                                />
                                <h3>{rec.title}</h3>
                            </div>

                            <div className="recommendation-content">
                                {rec.action && (
                                    <p className="recommendation-action">{rec.action}</p>
                                )}

                                {rec.students && (
                                    <div className="recommendation-details">
                                        <h4>Schüler:</h4>
                                        <ul>
                                            {rec.students.map((student, i) => (
                                                <li key={i}>{student}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {rec.questions && (
                                    <div className="recommendation-details">
                                        <h4>Fragen:</h4>
                                        <ul>
                                            {rec.questions.map((question, i) => (
                                                <li key={i}>{question}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="no-recommendations">
                    <FontAwesomeIcon icon={faCheckCircle}/>
                    <h3>Keine Probleme erkannt</h3>
                    <p>Die Klasse zeigt gute Leistungen.</p>
                </div>
            )}
        </div>
    );
};

export default RecommendationsTab;