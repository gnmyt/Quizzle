import React from 'react';
import './styles.sass';

const ClassOverview = ({analyticsData, isLiveQuiz}) => {
    const {classAnalytics, questionAnalytics} = analyticsData;

    const difficulty = questionAnalytics.reduce((acc, q) => {
        acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
        return acc;
    }, {});
    const total = questionAnalytics.length || 1;
    const easy = difficulty.easy || 0;
    const medium = difficulty.medium || 0;
    const hard = difficulty.hard || 0;

    const stats = [
        {label: 'Teilnehmer', value: classAnalytics.totalStudents},
        {label: 'Fragen', value: classAnalytics.totalQuestions},
        classAnalytics.ungraded ? {label: 'Bewertung', value: 'Keine'} : {label: 'Ø Genauigkeit', value: `${classAnalytics.averageAccuracy}%`, accent: classAnalytics.averageAccuracy >= 80 ? 'green' : classAnalytics.averageAccuracy >= 60 ? 'orange' : 'red'},
        ...(isLiveQuiz ? [{label: 'Ø Punkte', value: classAnalytics.averageScore}] : [])
    ];

    return (
        <div className="class-overview">
            <div className="overview-stats">
                {stats.map((s) => (
                    <div key={s.label} className={`overview-stat ${s.accent || ''}`}>
                        <div className="overview-stat-value">{s.value}</div>
                        <div className="overview-stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {!classAnalytics.ungraded && <div className="overview-card">
                <h3>Schwierigkeitsverteilung</h3>
                <div className="difficulty-bar">
                    {easy > 0 && <div className="difficulty-seg easy" style={{flex: easy}} title={`${easy} einfach`}/>}
                    {medium > 0 && <div className="difficulty-seg medium" style={{flex: medium}} title={`${medium} mittel`}/>}
                    {hard > 0 && <div className="difficulty-seg hard" style={{flex: hard}} title={`${hard} schwer`}/>}
                </div>
                <div className="difficulty-legend">
                    <span><span className="dot easy"/>Einfach · {easy}</span>
                    <span><span className="dot medium"/>Mittel · {medium}</span>
                    <span><span className="dot hard"/>Schwer · {hard}</span>
                </div>
            </div>}
        </div>
    );
};

export default ClassOverview;
