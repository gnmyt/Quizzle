import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartPie, faUsers, faQuestionCircle, faGraduationCap } from '@fortawesome/free-solid-svg-icons';
import ClassOverview from '../ClassOverview';
import StudentAnalytics from '../StudentAnalytics';
import QuestionAnalytics from '../QuestionAnalytics';
import RecommendationsTab from '../RecommendationsTab';
import './styles.sass';

const AnalyticsTabs = ({ analyticsData, quizData, isLiveQuiz = false }) => {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        {
            id: 'overview',
            title: 'Übersicht',
            icon: faChartPie,
            component: ClassOverview
        },
        {
            id: 'students',
            title: 'Schüler',
            icon: faUsers,
            component: StudentAnalytics
        },
        {
            id: 'questions',
            title: 'Fragen',
            icon: faQuestionCircle,
            component: QuestionAnalytics
        },
        {
            id: 'recommendations',
            title: 'Hinweise',
            icon: faGraduationCap,
            component: RecommendationsTab
        }
    ];

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="analytics-tabs">
            <div className="tab-navigation">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <FontAwesomeIcon icon={tab.icon} />
                        <span>{tab.title}</span>
                    </button>
                ))}
            </div>

            <div className="tab-content">
                {ActiveComponent && (
                    <ActiveComponent 
                        analyticsData={analyticsData} 
                        quizData={quizData}
                        isLiveQuiz={isLiveQuiz}
                    />
                )}
            </div>
        </div>
    );
};

export default AnalyticsTabs;