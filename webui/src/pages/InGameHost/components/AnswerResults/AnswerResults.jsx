import {motion} from "framer-motion";
import "./styles.sass";
import Button from "@/common/components/Button";
import {faForward} from "@fortawesome/free-solid-svg-icons";
import {useSoundManager} from "@/common/utils/SoundManager.js";
import {useEffect} from "react";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import {getAnswerColor, getAnswerGradient} from "@/common/utils/AnswerColorUtil.js";
import AnswerShape from "@/common/components/AnswerShape";
import WordCloud from '@/common/components/WordCloud';

export const AnswerResults = ({question, answerData, showScoreboard}) => {
    const soundManager = useSoundManager();

    useEffect(() => {
        const timer = setTimeout(() => {
            soundManager.playFeedback('ANSWER_REVEALED');
        }, 600);

        return () => clearTimeout(timer);
    }, [soundManager]);

    const getColor = (answer, index) => getAnswerColor(answer, index, question.type);
    const getGradient = (answer, index) => getAnswerGradient(answer, index, question.type);

    const getTextSize = (content) => {
        if (content.length <= 10) {
            return "3em";
        } else if (content.length <= 20) {
            return "2em";
        } else if (content.length <= 30) {
            return "1.5em";
        } else {
            return "1em";
        }
    }

    if (question.type === QUESTION_TYPES.WORD_CLOUD) {
        return (
            <div className="answer-results">
                <div className="top-area">
                    <Button onClick={showScoreboard} text="Scoreboard anzeigen" padding="1rem 1.5rem" icon={faForward}/>
                </div>
                <h1>{question.title}</h1>
                <WordCloud {...answerData}/>
            </div>
        );
    }

    if (question.type === QUESTION_TYPES.SLIDER) {
        const correctValue = answerData.correctValue;
        const min = answerData.min;
        const max = answerData.max;
        const playerValues = answerData.playerValues || [];
        const range = max - min;

        return (
            <div className="answer-results">
                <div className="top-area">
                    <Button onClick={showScoreboard} text="Scoreboard anzeigen"
                            padding="1rem 1.5rem" icon={faForward}/>
                </div>

                <h1>Richtige Antwort: {correctValue}</h1>

                <div className="slider-results">
                    <div className="slider-results-track">
                        <div className="slider-track-bg">
                            <motion.div
                                className="slider-correct-marker"
                                style={{left: `${((correctValue - min) / range) * 100}%`}}
                                initial={{scale: 0, x: "-50%", y: "-50%"}}
                                animate={{scale: 1, x: "-50%", y: "-50%"}}
                                transition={{duration: 0.5, delay: 0.3, type: "spring", stiffness: 200}}
                            >
                                <div className="marker-label">{correctValue}</div>
                                <div className="marker-dot correct" />
                            </motion.div>
                            {playerValues.map((value, index) => (
                                <motion.div
                                    key={index}
                                    className="slider-player-marker"
                                    style={{left: `${((value - min) / range) * 100}%`}}
                                    initial={{scale: 0, opacity: 0, x: "-50%", y: "-50%"}}
                                    animate={{scale: 1, opacity: 0.7, x: "-50%", y: "-50%"}}
                                    transition={{duration: 0.3, delay: 0.6 + index * 0.1}}
                                >
                                    <div className="marker-dot player" />
                                </motion.div>
                            ))}
                        </div>
                        <div className="slider-labels">
                            <span>{min}</span>
                            <span>{max}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (question.type === QUESTION_TYPES.TEXT) {
        return (
            <div className="answer-results">
                <div className="top-area">
                    <Button onClick={showScoreboard} text="Scoreboard anzeigen"
                            padding="1rem 1.5rem" icon={faForward}/>
                </div>

                <h1>Richtige Antworten</h1>

                <div className="correct-answers">
                    {answerData.answers.map((answer, index) => (
                        <motion.div
                            key={index}
                            className="correct-answer-item"
                            initial={{scale: 0, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            transition={{duration: 0.4, delay: index * 0.2, type: "spring", stiffness: 200}}
                        >
                            {answer}
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    if (question.type === QUESTION_TYPES.SEQUENCE) {
        return (
            <div className="answer-results">
                <div className="top-area">
                    <Button onClick={showScoreboard} text="Scoreboard anzeigen"
                            padding="1rem 1.5rem" icon={faForward}/>
                </div>

                <h1>Richtige Reihenfolge</h1>

                <div className="sequence-correct-order">
                    {answerData.answers.map((answer, index) => (
                        <motion.div
                            key={index}
                            className="sequence-answer-item"
                            initial={{scale: 0, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            transition={{duration: 0.4, delay: index * 0.2, type: "spring", stiffness: 200}}
                        >
                            <div className="sequence-position">{index + 1}</div>
                            <div className="sequence-content">{answer.content}</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    const maxVotes = Math.max(...(answerData.voteCounts || []), 1);

    return (
        <div className="answer-results">
            <div className="top-area">
                <Button onClick={showScoreboard} text="Scoreboard anzeigen"
                        padding="1rem 1.5rem" icon={faForward}/>
            </div>

            <h1>Antworten</h1>

            <motion.div
                className="vote-bars-section"
                initial={{opacity: 0, y: 30}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.6, ease: "easeOut"}}
            >
                {question.answers.map((answer, index) => {
                    const voteCount = answerData.voteCounts ? answerData.voteCounts[index] || 0 : 0;
                    const isCorrect = answer.is_correct;
                    const barHeight = (voteCount / maxVotes) * 100;

                    return (
                        <motion.div
                            key={index}
                            className="vote-bar-column"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            transition={{duration: 0.4, delay: 0.2 + index * 0.1}}
                        >
                            <motion.div
                                className="vote-count-display"
                                initial={{scale: 0}}
                                animate={{scale: 1}}
                                transition={{duration: 0.5, delay: 0.8 + index * 0.1, type: "spring", stiffness: 200}}
                            >
                                {voteCount}
                            </motion.div>
                            <div className="vote-bar-container">
                                <motion.div
                                    className={`vote-bar ${isCorrect ? 'correct' : ''}`}
                                    style={{
                                        backgroundColor: getAnswerColor(answer, index),
                                        height: `${barHeight}%`
                                    }}
                                    initial={{height: 0}}
                                    animate={{height: `${barHeight}%`}}
                                    transition={{duration: 1.2, delay: 0.4 + index * 0.1, ease: "easeOut"}}
                                />
                            </div>
                            <div className="vote-bar-shape" style={{background: getAnswerColor(answer, index)}}>
                                <AnswerShape index={index} size="1.4rem" questionType={question.type}/>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            <div className="answer-list">
                {question.answers.map((answer, index) => {
                    const isCorrect = answer.is_correct;

                    return (
                        <div key={index} className={`answer-container ${isCorrect ? 'correct-answer' : ''} ${!isCorrect ? 'incorrect-answer' : ''}`}>
                            {answer.type === "text" && (
                                <motion.div
                                    className="text-answer"
                                    style={{background: getGradient(answer, index)}}
                                    initial={{scale: 0}}
                                    animate={{scale: 1}}
                                    transition={{duration: 0.2, delay: 1.8 + index * 0.05}}
                                >
                                    <div className="answer-shape-wrap">
                                        <AnswerShape index={index} size="2rem" questionType={question.type}/>
                                    </div>
                                    <h2 style={{fontSize: getTextSize(answer.content)}}>{answer.content}</h2>
                                </motion.div>
                            )}
                            {answer.type === "image" && (
                                <div className="image-answer-wrap" style={{border: `6px solid ${getColor(answer, index)}`}}>
                                    <div className="answer-shape-wrap image-shape" style={{background: getColor(answer, index)}}>
                                        <AnswerShape index={index} size="1.5rem" questionType={question.type}/>
                                    </div>
                                    <motion.img
                                        src={answer.content}
                                        alt="Answer"
                                        className="image-answer"
                                        initial={{scale: 0}}
                                        animate={{scale: 1}}
                                        transition={{duration: 0.2, delay: 1.8 + index * 0.05}}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
