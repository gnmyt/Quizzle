import {motion} from "framer-motion";
import {QUESTION_TYPES} from "@/common/constants/QuestionTypes.js";
import "./styles.sass";
import WordCloud from '@/common/components/WordCloud';

const MC_TILES = [
    {color: "#E53B3B", shape: "triangle"},
    {color: "#1368CE", shape: "diamond"},
    {color: "#D89E00", shape: "circle"},
    {color: "#26890C", shape: "square"},
];

const containerVariants = {
    hidden: {opacity: 0, scale: 0.6, rotate: -8},
    visible: {
        opacity: 1,
        scale: 1,
        rotate: -6,
        transition: {type: "spring", stiffness: 160, damping: 14, delayChildren: 0.1, staggerChildren: 0.08}
    },
    exit: {opacity: 0, scale: 0.7, rotate: 4, transition: {duration: 0.3}}
};

const tileVariants = {
    hidden: {opacity: 0, scale: 0.3, y: 20},
    visible: {opacity: 1, scale: 1, y: 0, transition: {type: "spring", stiffness: 260, damping: 16}},
};

const Shape = ({kind}) => {
    switch (kind) {
        case "triangle":
            return <svg viewBox="0 0 24 24"><polygon points="12,4 22,20 2,20" fill="white"/></svg>;
        case "diamond":
            return <svg viewBox="0 0 24 24"><polygon points="12,3 21,12 12,21 3,12" fill="white"/></svg>;
        case "circle":
            return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="white"/></svg>;
        case "square":
        default:
            return <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1" fill="white"/></svg>;
    }
};

const MultipleChoiceTeaser = () => (
    <motion.div
        className="type-teaser-card mc"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
    >
        <div className="mc-grid">
            {MC_TILES.map((tile, i) => (
                <motion.div
                    key={i}
                    className="mc-tile"
                    style={{background: tile.color}}
                    variants={tileVariants}
                >
                    <Shape kind={tile.shape}/>
                </motion.div>
            ))}
        </div>
    </motion.div>
);

const TrueFalseTeaser = () => (
    <motion.div className="type-teaser-card tf" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
        <motion.div
            className="tf-tile tf-true"
            initial={{x: -200, opacity: 0, rotate: -8}}
            animate={{x: 0, opacity: 1, rotate: -4}}
            transition={{type: "spring", stiffness: 180, damping: 16, delay: 0.1}}
        >
            <svg viewBox="0 0 24 24"><polyline points="4,13 10,19 20,6" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </motion.div>
        <motion.div
            className="tf-tile tf-false"
            initial={{x: 200, opacity: 0, rotate: 8}}
            animate={{x: 0, opacity: 1, rotate: 4}}
            transition={{type: "spring", stiffness: 180, damping: 16, delay: 0.25}}
        >
            <svg viewBox="0 0 24 24">
                <line x1="6" y1="6" x2="18" y2="18" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
                <line x1="18" y1="6" x2="6" y2="18" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
            </svg>
        </motion.div>
    </motion.div>
);

const TextTeaser = () => {
    const letters = ["A", "B", "C"];
    return (
        <motion.div
            className="type-teaser-card text"
            initial={{opacity: 0, y: 30, scale: 0.8}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, scale: 0.8}}
            transition={{type: "spring", stiffness: 200, damping: 18}}
        >
            <div className="text-line">
                {letters.map((ch, i) => (
                    <motion.span
                        key={i}
                        className="text-char"
                        initial={{opacity: 0, y: -20}}
                        animate={{opacity: 1, y: 0}}
                        transition={{delay: 0.2 + i * 0.25, type: "spring", stiffness: 260, damping: 14}}
                    >
                        {ch}
                    </motion.span>
                ))}
                <motion.span
                    className="text-caret"
                    animate={{opacity: [1, 0, 1]}}
                    transition={{duration: 0.8, repeat: Infinity}}
                />
            </div>
        </motion.div>
    );
};

const SequenceTeaser = () => {
    const order = [3, 1, 4, 2];
    const colors = ["#E53B3B", "#1368CE", "#D89E00", "#26890C"];
    return (
        <motion.div
            className="type-teaser-card sequence"
            initial={{opacity: 0, scale: 0.8}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.8}}
            transition={{type: "spring", stiffness: 180, damping: 16}}
        >
            {order.map((num, idx) => (
                <motion.div
                    key={num}
                    className="seq-bar"
                    style={{background: colors[num - 1]}}
                    initial={{x: -40, opacity: 0}}
                    animate={{x: 0, opacity: 1, order: num}}
                    transition={{delay: 0.2 + idx * 0.15, type: "spring", stiffness: 220, damping: 18}}
                >
                    <motion.span
                        className="seq-num"
                        initial={{scale: 0}}
                        animate={{scale: 1}}
                        transition={{delay: 1.0 + num * 0.15, type: "spring", stiffness: 300}}
                    >
                        {num}
                    </motion.span>
                </motion.div>
            ))}
        </motion.div>
    );
};

const SliderTeaser = () => (
    <motion.div
        className="type-teaser-card slider"
        initial={{opacity: 0, scale: 0.8}}
        animate={{opacity: 1, scale: 1}}
        exit={{opacity: 0, scale: 0.8}}
        transition={{type: "spring", stiffness: 200, damping: 18}}
    >
        <div className="slider-track">
            <motion.div
                className="slider-fill"
                initial={{width: "0%"}}
                animate={{width: ["0%", "75%", "40%", "60%"]}}
                transition={{duration: 2, ease: "easeInOut"}}
            />
            <motion.div
                className="slider-knob"
                initial={{left: "0%"}}
                animate={{left: ["0%", "75%", "40%", "60%"]}}
                transition={{duration: 2, ease: "easeInOut"}}
            />
        </div>
    </motion.div>
);

const TEASERS = {
    [QUESTION_TYPES.WORD_CLOUD]: () => <WordCloud words={[{text: 'Wortwolke', count: 3}, {text: 'Eure Ideen', count: 1}]} totalResponses={4}/>,
    [QUESTION_TYPES.MULTIPLE_CHOICE]: MultipleChoiceTeaser,
    [QUESTION_TYPES.TRUE_FALSE]: TrueFalseTeaser,
    [QUESTION_TYPES.TEXT]: TextTeaser,
    [QUESTION_TYPES.SEQUENCE]: SequenceTeaser,
    [QUESTION_TYPES.SLIDER]: SliderTeaser,
};

export const QuestionTypeTeaser = ({isActive, type}) => {
    if (!isActive) return null;
    const Teaser = TEASERS[type] || MultipleChoiceTeaser;
    return (
        <div className="type-teaser-overlay">
            <Teaser/>
        </div>
    );
};
