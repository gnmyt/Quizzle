import "./styles.sass";
import {useContext, useEffect, useState} from "react";
import {QuizContext} from "@/common/contexts/Quiz";
import {useNavigate} from "react-router-dom";
import Scoreboard from "@/pages/InGameHost/components/Scoreboard/index.js";
import AnalyticsTabs from "@/common/components/AnalyticsTabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartBar, faTrophy } from "@fortawesome/free-solid-svg-icons";

export const EndingHost = () => {
    const {isLoaded, scoreboard} = useContext(QuizContext);
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('scoreboard');
    const [analyticsData, setAnalyticsData] = useState(null);

    useEffect(() => {
        if (!isLoaded) {
            navigate("/load");
            return;
        }

        if (scoreboard?.analytics) {
            setAnalyticsData(scoreboard.analytics);
        }
    }, [isLoaded, scoreboard]);

    const viewTabs = [
        { id: 'scoreboard', title: 'Ergebnisse', icon: faTrophy },
        { id: 'analytics', title: 'Analytics', icon: faChartBar }
    ];

    return (
        <div className="ending-page">
            <div className="ending-header">
                <h1>Quiz Beendet</h1>
                <div className="view-toggle">
                    {viewTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`toggle-button ${activeView === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveView(tab.id)}
                        >
                            <FontAwesomeIcon icon={tab.icon} />
                            <span>{tab.title}</span>
                        </button>
                    ))}
                </div>
            </div>

            {activeView === 'scoreboard' && (
                <Scoreboard 
                    isEnd 
                    nextQuestion={() => {}} 
                    scoreboard={Object.values(scoreboard?.scoreboard || {})} 
                />
            )}

            {activeView === 'analytics' && analyticsData && (
                <div className="analytics-container">
                    <AnalyticsTabs 
                        analyticsData={analyticsData}
                        quizData={null}
                        isLiveQuiz={true}
                    />
                </div>
            )}

            {activeView === 'analytics' && !analyticsData && (
                <div className="no-analytics">
                    <p>Keine Analytics-Daten verfügbar. Bitte stellen Sie sicher, dass das Quiz ordnungsgemäß beendet wurde.</p>
                </div>
            )}
        </div>
    )
}