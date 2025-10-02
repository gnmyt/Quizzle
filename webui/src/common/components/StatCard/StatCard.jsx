import React from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import './styles.sass';

const StatCard = ({icon, title, value, color = 'primary', subtitle}) => {
    return (
        <div className={`stat-card ${color}`}>
            <div className="stat-icon">
                <FontAwesomeIcon icon={icon}/>
            </div>
            <div className="stat-content">
                <div className="stat-value">{value}</div>
                <div className="stat-title">{title}</div>
                {subtitle && <div className="stat-subtitle">{subtitle}</div>}
            </div>
        </div>
    );
};

export default StatCard;